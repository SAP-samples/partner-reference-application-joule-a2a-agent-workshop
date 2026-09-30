import { tool } from "@langchain/core/tools";
import { z, ZodTypeAny } from "zod";
import { listTools, callTool } from "../mcp-client";

function jsonSchemaPropertyToZod(propSchema: Record<string, unknown>): ZodTypeAny {
    const type = propSchema.type as string | undefined;
    const desc = propSchema.description as string | undefined;
    let zType: ZodTypeAny;
    switch (type) {
        case "string":
            zType = z.string();
            break;
        case "number":
        case "integer":
            zType = z.number();
            break;
        case "boolean":
            zType = z.boolean();
            break;
        case "array": {
            const items = propSchema.items as Record<string, unknown> | undefined;
            zType = z.array(items ? jsonSchemaPropertyToZod(items) : z.unknown());
            break;
        }
        case "object":
            zType = buildZodObject(propSchema);
            break;
        default:
            zType = z.unknown();
    }
    return desc ? zType.describe(desc) : zType;
}

function buildZodObject(schema: Record<string, unknown>): z.ZodObject<Record<string, ZodTypeAny>> {
    const props = (schema.properties || {}) as Record<string, Record<string, unknown>>;
    const required = (schema.required || []) as string[];
    const shape: Record<string, ZodTypeAny> = {};
    for (const [key, val] of Object.entries(props)) {
        const field = jsonSchemaPropertyToZod(val);
        shape[key] = required.includes(key) ? field : field.optional();
    }
    return z.object(shape);
}

// getTools() is called lazily by LangGraphAgentExecutor on first execute.
// Do NOT cache fallback tools — on failure, retry discovery on the next request.
export async function getTools() {
    const result = await listTools();
    return (result.tools || []).map((mcpTool) => {
        const inputSchema = (mcpTool.inputSchema || {}) as Record<string, unknown>;
        const zodSchema = buildZodObject(inputSchema);
        return tool(
            async (args: Record<string, unknown>) => {
                try {
                    const res = await callTool(mcpTool.name, args);
                    // MCP content is { content: [{ type: "text", text: "..." }] }
                    if (res && Array.isArray((res as Record<string, unknown>).content)) {
                        const texts = ((res as Record<string, unknown>).content as Array<{ type: string; text?: string }>)
                            .filter((c) => c.type === "text" && c.text)
                            .map((c) => c.text as string);
                        return texts.length ? texts.join("\n") : JSON.stringify(res);
                    }
                    return JSON.stringify(res);
                } catch (err) {
                    return `Error calling ${mcpTool.name}: ${err instanceof Error ? err.message : String(err)}`;
                }
            },
            {
                name: mcpTool.name,
                description: mcpTool.description || mcpTool.name,
                schema: zodSchema,
            }
        );
    });
}
