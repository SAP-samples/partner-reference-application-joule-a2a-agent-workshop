import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getUserToken } from "./utils/user-context";

interface TokenCache {
    accessToken: string;
    expiresAt: number;
}

// CF: destination service token (for calling the Destination Configuration API itself)
let _destServiceToken: TokenCache | null = null;

// Local dev: CAP app token + normalized URL
let _localConnection: (TokenCache & { mcpUrl: string }) | null = null;

const isFresh = (c: TokenCache | null): c is TokenCache =>
    c !== null && Date.now() < c.expiresAt;

function clearCaches(): void {
    _destServiceToken = null;
    _localConnection = null;
}

function isAuthError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return /401|403|unauthorized|forbidden/i.test(msg);
}

function isCloudFoundry(): boolean {
    return !!process.env.VCAP_SERVICES;
}

interface DestServiceCredentials {
    clientid: string;
    clientsecret: string;
    uri: string;
    url: string;
}

function getDestServiceBinding(): DestServiceCredentials {
    const vcap = JSON.parse(process.env.VCAP_SERVICES || "{}");
    const dests = (vcap["destination"] || vcap["Destination"]) as Array<{ credentials: DestServiceCredentials }> | undefined;
    if (!dests || !dests.length) {
        throw new Error("No destination service binding found in VCAP_SERVICES");
    }
    return dests[0].credentials;
}

interface XsuaaCredentials {
    clientid: string;
    clientsecret: string;
    url: string;
}

function getXsuaaBinding(): XsuaaCredentials {
    const vcap = JSON.parse(process.env.VCAP_SERVICES || "{}");
    const xsuaaBindings = vcap["xsuaa"] as Array<{ credentials: XsuaaCredentials }> | undefined;
    if (!xsuaaBindings || !xsuaaBindings.length) {
        throw new Error("No XSUAA service binding found in VCAP_SERVICES");
    }
    return xsuaaBindings[0].credentials;
}

/**
 * Exchange an IAS JWT for an XSUAA token via the JWT Bearer assertion flow.
 *
 * This is necessary because the Destination Service's `OAuth2UserTokenExchange`
 * requires an XSUAA token in the `X-user-token` header — it cannot work with
 * raw IAS tokens. The agent's own XSUAA instance (which trusts IAS via the
 * subaccount-level IAS trust configuration) can perform this exchange.
 *
 * Grant type: urn:ietf:params:oauth:grant-type:jwt-bearer
 */
async function exchangeIasTokenForXsuaa(iasJwt: string): Promise<string> {
    const xsuaa = getXsuaaBinding();
    const tokenUrl = xsuaa.url.endsWith("/oauth/token")
        ? xsuaa.url
        : `${xsuaa.url}/oauth/token`;

    const params = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: iasJwt,
        client_id: xsuaa.clientid,
        client_secret: xsuaa.clientsecret,
        response_type: "token",
    });

    console.log("[MCP] Exchanging IAS token for XSUAA token via jwt-bearer grant...");

    const resp = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`IAS→XSUAA token exchange failed (${resp.status}): ${text}`);
    }

    const data = await resp.json() as { access_token: string };
    console.log("[MCP] IAS→XSUAA token exchange successful");
    return data.access_token;
}

async function fetchToken(tokenUrl: string, clientId: string, clientSecret: string): Promise<TokenCache> {
    const params = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
    });
    const resp = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Token fetch failed (${resp.status}): ${text}`);
    }
    const data = await resp.json() as { access_token: string; expires_in: number };
    // Subtract 5-minute safety buffer from expiry
    const expiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return { accessToken: data.access_token, expiresAt };
}

/**
 * Fetch the PSM_CAP_APP destination from the Destination Configuration API.
 *
 * Principal propagation flow (OAuth2UserTokenExchange):
 *   1. The incoming IAS JWT from Joule is exchanged for an XSUAA token via
 *      the agent's own XSUAA binding (jwt-bearer grant).
 *   2. The XSUAA token is passed as `X-user-token` header to the
 *      Destination Service "find destination" API.
 *   3. The Destination Service sees the destination is OAuth2UserTokenExchange.
 *   4. It extracts the user identity from the XSUAA token in X-user-token,
 *      then uses the service broker's client credentials (configured in the
 *      destination) to request a new XSUAA token from the CAP app's XSUAA.
 *   5. The exchanged token (containing user identity + CAP app scopes)
 *      is returned in the `authTokens` array.
 *
 * Fallback (no user token — e.g. startup tool discovery):
 *   - Uses the destination service's own client_credentials token.
 *   - The destination's OAuth flow runs as a technical user.
 */
async function fetchDestination(
    destBinding: DestServiceCredentials,
    destServiceToken: string,
    userToken?: string,
): Promise<{ mcpUrl: string; accessToken: string }> {
    const destApiUrl = `${destBinding.uri}/destination-configuration/v1/destinations/PSM_CAP_APP`;

    const headers: Record<string, string> = {
        Authorization: `Bearer ${destServiceToken}`,
    };

    // For OAuth2UserTokenExchange, the Destination Service requires:
    //   - Authorization: client_credentials token (to authenticate the API call)
    //   - X-user-token: XSUAA token (user identity to be exchanged)
    //
    // The incoming token from Joule is an IAS JWT, so we first exchange it
    // for an XSUAA token using the agent's own XSUAA binding, then pass
    // the resulting XSUAA token as X-user-token.
    let xsuaaUserToken: string | undefined;
    if (userToken) {
        try {
            xsuaaUserToken = await exchangeIasTokenForXsuaa(userToken);
            headers["X-user-token"] = xsuaaUserToken;
            console.log("[MCP] Passing exchanged XSUAA user token as X-user-token for principal propagation");
        } catch (err) {
            console.error("[MCP] IAS→XSUAA exchange failed, falling back to technical user:", err);
            // Fall through without X-user-token — technical user fallback
        }
    } else {
        console.log("[MCP] No user token available — using technical client_credentials token");
    }

    const destResp = await fetch(destApiUrl, { headers });
    if (!destResp.ok) {
        const text = await destResp.text();
        throw new Error(`Destination fetch failed (${destResp.status}): ${text}`);
    }

    const destConfig = await destResp.json() as {
        destinationConfiguration: {
            URL: string;
            tokenServiceURL: string;
            clientId: string;
            clientSecret: string;
        };
        authTokens?: Array<{
            type: string;
            value: string;
            http_header: { key: string; value: string };
            expires_in: string;
            error?: string;
        }>;
    };
    const cfg = destConfig.destinationConfiguration;

    // Append MCP path to destination base URL
    const baseUrl = cfg.URL.replace(/\/$/, "");
    const mcpUrl = baseUrl.endsWith("/mcp/poetry-slam-mcp")
        ? baseUrl
        : `${baseUrl}/mcp/poetry-slam-mcp`;

    // When the XSUAA user token was successfully exchanged and passed as X-user-token,
    // the Destination Service returns the exchanged CAP-app XSUAA token in authTokens.
    if (xsuaaUserToken && destConfig.authTokens?.length) {
        const authToken = destConfig.authTokens.find(t => t.value && !t.error);
        if (authToken) {
            return { mcpUrl, accessToken: authToken.value };
        }
        // If token exchange failed, log the error from authTokens
        const errorToken = destConfig.authTokens.find(t => t.error);
        if (errorToken) {
            throw new Error(`Destination token exchange failed: ${errorToken.error}`);
        }
    }

    // Fallback: no user JWT or no authTokens returned — fetch token manually
    // using the destination's service-broker credentials (technical user)
    const capToken = await fetchToken(cfg.tokenServiceURL, cfg.clientId, cfg.clientSecret);
    return { mcpUrl, accessToken: capToken.accessToken };
}

// URL and token must be resolved together — the CF destination base URL is only
// available when fetching the destination config, so both are derived in one code path.
async function resolveUrlAndToken(): Promise<{ mcpUrl: string; accessToken: string }> {
    if (isCloudFoundry()) {
        const destBinding = getDestServiceBinding();
        const userToken = getUserToken(); // From AsyncLocalStorage (set in server.ts)

        // Cache destination service token independently (for calling the Destination Config API)
        if (!isFresh(_destServiceToken)) {
            // Use destBinding.url (XSUAA token endpoint) — NOT destBinding.uri (Destination Config API)
            const tokenUrl = destBinding.url.endsWith("/oauth/token")
                ? destBinding.url
                : `${destBinding.url}/oauth/token`;
            _destServiceToken = await fetchToken(tokenUrl, destBinding.clientid, destBinding.clientsecret);
        }

        // NOTE: We do NOT cache the CAP app token when userToken is present because
        // each user's exchanged XSUAA token is unique to that user.
        return fetchDestination(destBinding, _destServiceToken.accessToken, userToken);
    } else {
        // Return cached local connection if still fresh
        if (isFresh(_localConnection)) {
            return { mcpUrl: _localConnection.mcpUrl, accessToken: _localConnection.accessToken };
        }

        // Never use PSM_CAP_URL as-is — always normalize by appending the MCP path
        const baseUrl = (process.env.PSM_CAP_URL || "http://localhost:4004").replace(/\/$/, "");
        const mcpUrl = baseUrl.endsWith("/mcp/poetry-slam-mcp")
            ? baseUrl
            : `${baseUrl}/mcp/poetry-slam-mcp`;

        const tokenUrl = process.env.XSUAA_TOKEN_URL;
        const clientId = process.env.XSUAA_CLIENT_ID;
        const clientSecret = process.env.XSUAA_CLIENT_SECRET;

        if (!tokenUrl || !clientId || !clientSecret) {
            throw new Error("Missing XSUAA_TOKEN_URL, XSUAA_CLIENT_ID, or XSUAA_CLIENT_SECRET");
        }

        const localToken = await fetchToken(tokenUrl, clientId, clientSecret);
        _localConnection = { ...localToken, mcpUrl };
        return { mcpUrl, accessToken: localToken.accessToken };
    }
}

async function createMcpClient(mcpUrl: string, accessToken: string): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
        requestInit: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json, text/event-stream",
            },
        },
    });
    const client = new Client({ name: "psm-joule-agent", version: "1.0.0" });
    await client.connect(transport);
    return client;
}

export async function listTools() {
    const { mcpUrl, accessToken } = await resolveUrlAndToken();
    const client = await createMcpClient(mcpUrl, accessToken);
    try {
        return await client.listTools();
    } finally {
        await client.close();
    }
}

export async function callTool(name: string, args: Record<string, unknown>) {
    for (let attempt = 0; attempt <= 1; attempt++) {
        if (attempt > 0) clearCaches();
        const { mcpUrl, accessToken } = await resolveUrlAndToken();
        const client = await createMcpClient(mcpUrl, accessToken);
        try {
            return await client.callTool({ name, arguments: args });
        } catch (error) {
            if (attempt === 0 && isAuthError(error)) continue;
            throw error;
        } finally {
            await client.close();
        }
    }
    throw new Error("callTool: unreachable after retry loop");
}
