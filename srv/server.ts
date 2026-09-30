import cds from "@sap/cds";
import express, { Express, Request, Response, NextFunction } from "express";
import type { AgentCard } from "@a2a-js/sdk";
import {
    AgentExecutor,
    InMemoryTaskStore,
    DefaultRequestHandler,
} from "@a2a-js/sdk/server";
import { jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { LangGraphAgentExecutor } from "./agent-executor";
import { v4 as uuidv4 } from "uuid";
import { runWithUserContext } from "./utils/user-context";

const VCAP = process.env.VCAP_APPLICATION;
const getA2aServerUrl = (): string =>
    VCAP ? `https://${JSON.parse(VCAP).application_uris[0]}/` : "http://localhost:4004/";

// Joule v0.2.x compat: translate tasks/send → message/send before jsonRpcHandler sees it.
// Do NOT forward params.id as message.taskId — the v0.2 task ID doesn't exist in
// InMemoryTaskStore yet and causes DefaultRequestHandler to fail with "Task not found".
function tasksSendTranslator(req: Request, _res: Response, next: NextFunction): void {
    if (req.body?.method !== "tasks/send") {
        next();
        return;
    }
    const orig = req.body;
    const params = orig.params || {};
    const origMessage = params.message || {};

    // Convert parts: v0.2 { type, text } → v0.3 { kind, text }
    const parts = ((origMessage.parts || []) as Array<Record<string, string>>).map((p) => ({
        kind: p.kind || p.type || "text",
        text: p.text,
    }));

    req.body = {
        jsonrpc: "2.0",
        id: orig.id,
        method: "message/send",
        params: {
            message: {
                kind: "message",
                messageId: uuidv4(),
                role: "user",
                parts,
                contextId: params.sessionId || params.contextId || undefined,
            },
        },
    };
    next();
}

// Strip taskId from message/send requests: InMemoryTaskStore is ephemeral — after a task
// completes or the process restarts, the taskId no longer exists, causing "Task not found".
// contextId is sufficient for continuity since conversation history is maintained by contextId.
function stripTaskId(req: Request, _res: Response, next: NextFunction): void {
    if (req.body?.method === "message/send" && req.body?.params?.message?.taskId) {
        delete req.body.params.message.taskId;
    }
    next();
}

const agentCard: AgentCard = {
    name: "psm-joule-agent",
    description: "Poetry Slam Manager agent — query poetry slams, visitors, and visit bookings via SAP CAP MCP",
    url: getA2aServerUrl(),
    provider: { organization: "joule.ext", url: "https://example.com" },
    version: "1.0.0",
    capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: [
        {
            id: "query-poetry-slams",
            name: "Query Poetry Slams",
            description: "List, search, and filter poetry slams by status, date, available seats, fee, currency, and more",
            tags: ["poetry-slams", "query"],
            examples: [
                "Show me all poetry slams",
                "List cancelled poetry slams",
                "Which published poetry slams still have free seats?",
                "Show me poetry slams in October 2026",
                "Show the cheapest poetry slams in EUR ordered by price",
                "How many poetry slams are published?",
            ],
            outputModes: ["text/plain"],
        },
        {
            id: "query-visitors",
            name: "Query Visitors",
            description: "Search and list visitors registered in the Poetry Slam Manager",
            tags: ["visitors", "query"],
            examples: [
                "Show me visitors named Smith",
                "List all visitors from Germany",
            ],
            outputModes: ["text/plain"],
        },
        {
            id: "query-visits",
            name: "Query Visit Bookings",
            description: "Show visit bookings and who attended which poetry slam",
            tags: ["visits", "bookings", "query"],
            examples: [
                "Who visited the Berlin Poetry Slam?",
                "Show me all visit bookings",
            ],
            outputModes: ["text/plain"],
        },
    ],
    supportsAuthenticatedExtendedCard: false,
    protocolVersion: "0.3.0",
};

// @ts-ignore
cds.on("bootstrap", (app: Express) => {
    console.log("[A2A] Registering A2A routes on bootstrap...");

    const taskStore = new InMemoryTaskStore();
    const agentExecutor: AgentExecutor = new LangGraphAgentExecutor();
    const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);

    // Must be first: parse JSON before any A2A middleware runs.
    // The SDK's jsonRpcHandler calls express.json() internally too, but body-parser
    // skips re-parsing when the body is already parsed — so this is safe.
    app.use(express.json());

    // Joule v0.2.x compat: rewrite tasks/send as message/send
    app.use("/", tasksSendTranslator);

    // Multi-turn: strip taskId so InMemoryTaskStore doesn't fail with "Task not found"
    app.use("/", stripTaskId);

    // Serve agent card as a plain GET (more reliable with CAP middleware than agentCardHandler)
    app.get("/.well-known/agent.json", (_req: Request, res: Response) => {
        res.json(agentCard);
    });

    // A2A JSON-RPC endpoint — wrapped with user context for principal propagation.
    //
    // Flow on Cloud Foundry (production):
    //   1. Joule sends IAS JWT in Authorization header
    //   2. CAP's XSUAA auth middleware validates the IAS JWT
    //      (IAS is trusted by the agent's XSUAA instance)
    //   3. The validated token is stored in AsyncLocalStorage via runWithUserContext
    //   4. Downstream code (mcp-client.ts) retrieves the token and passes it to
    //      the Destination Service, which performs OAuth2UserTokenExchange using
    //      the service broker credentials to get a CAP-app-scoped XSUAA token
    //   5. The final XSUAA token carries the Joule user's identity → principal propagation
    const a2aHandler = jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication });

    app.use("/", (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
            runWithUserContext({ req }, () => {
                a2aHandler(req, res, next);
            });
        } else {
            // No JWT available — fall through without user context (e.g. local dev)
            a2aHandler(req, res, next);
        }
    });

    console.log("[A2A] Routes registered successfully");
});
