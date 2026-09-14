import { DEFAULT_GENERATION_SETTINGS } from "@void-mind/mind-core";
import { describe, expect, it, vi } from "vitest";
import {
  CodexProvider,
  normalizeCodexModels,
  type CodexBridge,
  type CodexProtocolModel,
  type CodexRuntimeEvent,
  type CodexRuntimeStatus,
  type CodexAccountState
} from "./codex";
import type { ProviderEvent } from "./types";

const runtimeModel: CodexProtocolModel = {
  id: "runtime-model",
  displayName: "Runtime Model",
  description: "Discovered from the installed runtime.",
  isDefault: true,
  reasoningEfforts: [
    { id: "low", description: "Fast" },
    { id: "high", description: "Deep" }
  ],
  defaultReasoningEffort: "high",
  inputModalities: ["text", "image"],
  supportsPersonality: false,
  serviceTiers: [{ id: "priority", name: "Priority", description: "Faster" }],
  defaultServiceTier: "priority"
};

function createBridge() {
  let listener: ((event: CodexRuntimeEvent) => void) | undefined;
  const running: CodexRuntimeStatus = { installed: true, running: true, state: "running" };
  const ready: CodexRuntimeStatus = { installed: true, running: false, state: "ready" };
  const account: CodexAccountState = { state: "connected", planType: "plus" };
  const bridge: CodexBridge = {
    status: vi.fn(async () => running),
    start: vi.fn(async () => running),
    stop: vi.fn(async () => ready),
    account: vi.fn(async () => account),
    beginLogin: vi.fn(),
    cancelLogin: vi.fn(),
    logout: vi.fn(),
    openAuthUrl: vi.fn(),
    models: vi.fn(async () => [runtimeModel]),
    startThread: vi.fn(async () => ({ remoteThreadId: "thread-1" })),
    resumeThread: vi.fn(async ({ remoteThreadId }) => ({ remoteThreadId })),
    startTurn: vi.fn(async () => ({ turnId: "turn-1" })),
    interrupt: vi.fn(async () => undefined),
    subscribe: vi.fn(async (next) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    })
  };
  return { bridge, emit: (event: CodexRuntimeEvent) => listener?.(event) };
}

const request = {
  conversationId: "conversation-1",
  messages: [
    {
      id: "message-1",
      role: "user" as const,
      content: "Hello",
      createdAt: "2026-09-02T12:00:00.000Z"
    }
  ],
  model: normalizeCodexModels([runtimeModel])[0],
  settings: DEFAULT_GENERATION_SETTINGS,
  reasoningEffort: "high",
  serviceTier: "priority"
};

describe("Codex provider", () => {
  it("normalizes live model metadata without a hardcoded catalog", () => {
    expect(normalizeCodexModels([runtimeModel])).toEqual([
      expect.objectContaining({
        id: "openai-codex:runtime-model",
        identifier: "runtime-model",
        isDefault: true,
        defaultReasoningEffort: "high",
        defaultServiceTier: "priority",
        capabilities: ["conversation", "streaming", "image-input", "reasoning"]
      })
    ]);
  });

  it("binds a local conversation to a Codex thread and streams its turn", async () => {
    const { bridge, emit } = createBridge();
    const provider = new CodexProvider(bridge);
    const events: ProviderEvent[] = [];
    const consume = (async () => {
      for await (const event of provider.generate(request)) events.push(event);
    })();

    await vi.waitFor(() => expect(bridge.startTurn).toHaveBeenCalled());
    emit({
      type: "assistantDelta",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "item-1",
      delta: "Hello back"
    });
    emit({ type: "turnCompleted", threadId: "thread-1", turnId: "turn-1", status: "completed" });
    await consume;

    expect(events).toEqual([
      { type: "binding", remoteThreadId: "thread-1" },
      { type: "start", turnId: "turn-1" },
      { type: "token", content: "Hello back" },
      { type: "done", finishReason: "completed" }
    ]);
    expect(bridge.startThread).toHaveBeenCalledWith({
      model: "runtime-model",
      contextInstructions: undefined
    });
  });

  it("interrupts the active runtime turn when cancelled", async () => {
    const { bridge, emit } = createBridge();
    const provider = new CodexProvider(bridge);
    const iterator = provider.generate(request);
    await iterator.next();
    await iterator.next();
    provider.cancel();
    await vi.waitFor(() =>
      expect(bridge.interrupt).toHaveBeenCalledWith({
        remoteThreadId: "thread-1",
        turnId: "turn-1"
      })
    );
    emit({ type: "turnCompleted", threadId: "thread-1", turnId: "turn-1", status: "interrupted" });
    await iterator.next();
  });

  it("ends an aborted stream as an abort instead of a completed response", async () => {
    const { bridge } = createBridge();
    const provider = new CodexProvider(bridge);
    const controller = new AbortController();
    const iterator = provider.generate(request, controller.signal);
    await iterator.next();
    await iterator.next();
    const pending = iterator.next();
    controller.abort(new DOMException("Stopped", "AbortError"));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(bridge.interrupt).toHaveBeenCalledWith({
      remoteThreadId: "thread-1",
      turnId: "turn-1"
    });
  });
});
