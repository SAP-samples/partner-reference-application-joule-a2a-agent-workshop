import { v4 as uuidv4 } from "uuid";
import cds from "@sap/cds";
import { Message, TextPart } from "@a2a-js/sdk";
import { AgentExecutor, RequestContext, ExecutionEventBus } from "@a2a-js/sdk/server";
import { OrchestrationClient } from "@sap-ai-sdk/langchain";
import { END, START, Command, MemorySaver, MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { BaseMessageLike } from "@langchain/core/messages";
import { a2aMessagesToLangChain } from "./utils/a2aToLangchain";
import { getTools } from "./tools/tools";
import { getSystemPrompt } from "./utils/prompts";
import { createInterruptUpdate, createMessage, createMessageUpdate, createNewTask } from "./utils/a2a-operations";

const logger = cds.log("agent");
const contexts = new Map<string, Message[]>();

type AgentGraphState = { messages: BaseMessageLike[] };

export class LangGraphAgentExecutor implements AgentExecutor {
    private app: unknown = null;

    // Initialize lazily on first execute() call.
    // If getTools() fails, this.app remains null so the next request retries discovery.
    private async initApp(): Promise<ReturnType<typeof StateGraph.prototype.compile>> {
        if (this.app) return this.app as ReturnType<typeof StateGraph.prototype.compile>;

        const agentTools = await getTools();
        const model = new OrchestrationClient({
            promptTemplating: { model: { name: process.env.MODEL_NAME || "gpt-4.1" } },
        });
        const modelWithTools = model.bindTools(agentTools);

        const agentNode = async (state: AgentGraphState) => {
            const response = await modelWithTools.invoke([
                { role: "system", content: getSystemPrompt() },
                ...state.messages,
            ]);
            return { messages: [response] };
        };

        const shouldContinue = (state: AgentGraphState) => {
            const last = state.messages.at(-1) as { tool_calls?: unknown[] } | undefined;
            return last?.tool_calls?.length ? "tools" : END;
        };

        const toolNode = new ToolNode(agentTools);
        const stateGraph = new StateGraph(MessagesAnnotation)
            .addNode("agent", agentNode)
            .addNode("tools", toolNode)
            .addEdge(START, "agent")
            .addConditionalEdges("agent", shouldContinue, ["tools", END])
            .addEdge("tools", "agent");

        this.app = stateGraph.compile({ checkpointer: new MemorySaver() });
        return this.app as ReturnType<typeof StateGraph.prototype.compile>;
    }

    async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
        const app = await this.initApp();
        const userMessage = requestContext.userMessage;
        const existingTask = requestContext.task;
        const taskId = existingTask?.id || requestContext.taskId || uuidv4();
        const contextId = userMessage.contextId || existingTask?.contextId || uuidv4();

        if (!existingTask) {
            eventBus.publish(createNewTask(userMessage, { taskId, contextId }));
        }
        eventBus.publish(createMessageUpdate("Processing your request...", { taskId, contextId, final: false }));

        // Build conversation history for this context
        const historyForAgent = contexts.get(contextId) || [];
        if (!historyForAgent.some((m) => m.messageId === userMessage.messageId)) {
            historyForAgent.push(userMessage);
        }
        contexts.set(contextId, historyForAgent);

        const messages = a2aMessagesToLangChain(historyForAgent);
        const messageText = userMessage.parts
            .filter((p): p is TextPart => p.kind === "text")
            .map((p) => p.text)
            .join(" ");

        let res;
        if (requestContext.task) {
            // Resuming an interrupted task
            res = await app.stream(
                new Command({ resume: messageText }),
                { configurable: { thread_id: requestContext.taskId } }
            );
        } else {
            res = await app.stream(
                { messages },
                { configurable: { thread_id: taskId } }
            );
        }

        let finalRes = "";
        for await (const chunk of res as AsyncIterable<Record<string, unknown>>) {
            if (!("__interrupt__" in chunk)) {
                const agentMessages = (chunk.agent as { messages?: unknown[] } | undefined)?.messages;
                if (Array.isArray(agentMessages)) {
                    const last = agentMessages.at(-1);
                    if (last instanceof Object && "content" in last) {
                        finalRes += (last as { content: string }).content;
                    }
                }
                continue;
            }

            // Human-in-the-loop interrupt
            type InterruptChunk = { __interrupt__: Array<{ value: string }> };
            const interruptValue = (chunk as unknown as InterruptChunk).__interrupt__[0].value;
            eventBus.publish(createInterruptUpdate(interruptValue, { taskId, contextId }));
            eventBus.finished();
            return;
        }

        const finalMessage: Message = createMessage(finalRes, { taskId, contextId });
        historyForAgent.push(finalMessage);
        contexts.set(contextId, historyForAgent);
        eventBus.publish(createMessageUpdate(finalMessage, { taskId, contextId, final: true }));
        eventBus.finished();
        logger.log(`Task ${taskId} completed`);
    }

    public cancelTask = async (_taskId: string, _eventBus: ExecutionEventBus): Promise<void> => {};
}
