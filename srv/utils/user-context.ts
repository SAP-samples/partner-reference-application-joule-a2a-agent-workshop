import { AsyncLocalStorage } from "async_hooks";
import type { Request } from "express";

interface UserContext {
    /** The original Express request — carries the Authorization header.
     *  After CAP XSUAA auth middleware runs, the token in this header
     *  has been validated (IAS→XSUAA exchange happens at XSUAA level). */
    req: Request;
}

/**
 * AsyncLocalStorage propagates user context across the entire async call chain
 * within a single HTTP request — from Express middleware → A2A handler →
 * agent executor → MCP client → Destination Service call.
 */
const userContextStorage = new AsyncLocalStorage<UserContext>();

/**
 * Run a function within a user context scope.
 * All code executed inside `fn` (including async continuations) can
 * retrieve the user's token via `getUserToken()`.
 */
export function runWithUserContext<T>(context: UserContext, fn: () => T): T {
    return userContextStorage.run(context, fn);
}

/**
 * Retrieve the current request's Bearer token (JWT).
 *
 * On Cloud Foundry with XSUAA bound:
 *   - The incoming IAS JWT from Joule is validated by CAP's XSUAA middleware
 *   - This token is then used by the Destination Service for OAuth2UserTokenExchange
 *   - The Destination Service exchanges it for a CAP-app-scoped XSUAA token
 *
 * Returns `undefined` when called outside a `runWithUserContext` scope
 * (e.g. during tool discovery at startup).
 */
export function getUserToken(): string | undefined {
    const req = userContextStorage.getStore()?.req;
    const authHeader = req?.headers?.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.substring(7);
    }
    return undefined;
}

// Backwards compatibility alias
export const getUserJwt = getUserToken;

