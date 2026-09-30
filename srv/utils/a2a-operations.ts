import { Message, Task, TaskStatusUpdateEvent } from "@a2a-js/sdk";
import { v4 as uuidv4 } from "uuid";

export function createNewTask(message: Message, options: { taskId: string; contextId: string }): Task {
    return {
        kind: "task", id: options.taskId, contextId: options.contextId,
        status: { state: "submitted", timestamp: new Date().toISOString() },
        history: [message], metadata: message.metadata,
    };
}

export function createMessageUpdate(message: string | Message, options: { taskId: string; contextId: string; final: boolean }): TaskStatusUpdateEvent {
    const statusMessage: Message = typeof message === "string"
        ? { kind: "message", messageId: uuidv4(), role: "agent", parts: [{ kind: "text", text: message }], taskId: options.taskId, contextId: options.contextId }
        : message;
    return {
        kind: "status-update", taskId: options.taskId, contextId: options.contextId,
        status: { state: options.final ? "completed" : "working", message: statusMessage, timestamp: new Date().toISOString() },
        final: false,
    };
}

export function createInterruptUpdate(message: string, options: { taskId: string; contextId: string }): TaskStatusUpdateEvent {
    return {
        kind: "status-update", taskId: options.taskId, contextId: options.contextId,
        status: {
            state: "input-required",
            message: { kind: "message", role: "agent", messageId: uuidv4(), parts: [{ kind: "text", text: message }], taskId: options.taskId, contextId: options.contextId },
            timestamp: new Date().toISOString(),
        },
        final: true,
    };
}

export function createMessage(message: string, options: { taskId: string; contextId: string }): Message {
    return { kind: "message", messageId: uuidv4(), role: "agent", parts: [{ kind: "text", text: message }], taskId: options.taskId, contextId: options.contextId };
}
