import type { Message, TextPart } from "@a2a-js/sdk";
import { HumanMessage, AIMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";

function extractTextParts(m: Message): string {
    return (m.parts ?? [])
        .filter((p): p is TextPart => p.kind === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join("\n")
        .trim();
}

function toLangChainMessage(role: string, text: string): BaseMessage {
    switch (role) {
        case "user": return new HumanMessage(text);
        case "agent": case "assistant": return new AIMessage(text);
        case "system": return new SystemMessage(text);
        default: return new HumanMessage(text);
    }
}

export function a2aMessagesToLangChain(history: Message[]): BaseMessage[] {
    return history.map((m) => toLangChainMessage(m.role, extractTextParts(m)));
}
