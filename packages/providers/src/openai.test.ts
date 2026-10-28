import { describe, expect, it, vi } from "vitest";
import { connectionAvailable, normalizeOpenAIModels, OpenAIProvider, type ConnectionStreamEvent, type OpenAIBridge } from "./openai";
import { DEFAULT_PROFILES } from "@void-mind/mind-core";

function fixture() {
  let listener: (event: ConnectionStreamEvent) => void = () => undefined;
  const bridge: OpenAIBridge = {
    models: vi.fn(async () => [{ id: "actual", displayName: "Actual model" }]),
    status: vi.fn(async () => ({ accounts: [], apiConnected: true, welcomePending: false })),
    cancel: vi.fn(async () => undefined),
    subscribe: vi.fn(async (callback) => { listener = callback; return vi.fn(); }),
    generate: vi.fn(async () => undefined)
  };
  const request = { conversationId: "chat", messages: [{ id: "u", role: "user" as const, content: "Question", createdAt: "now" }],
    model: normalizeOpenAIModels([{ id: "actual", displayName: "Actual" }], "openai-api")[0], settings: DEFAULT_PROFILES[0].settings, contextInstructions: "Selected source" };
  return { bridge, request, emit: (event: ConnectionStreamEvent) => listener(event) };
}
describe("direct OpenAI connections", () => {
  it("keeps catalogs and eligibility separate", () => {
    const model = [{ id: "same", displayName: "Same" }];
    expect(normalizeOpenAIModels(model, "openai-api")[0].id).not.toBe(normalizeOpenAIModels(model, "openai-chatgpt")[0].id);
    const status = { accounts: [{ id: "a", connected: true, planAuthorized: false }], activeAccountId: "a", apiConnected: true, welcomePending: false };
    expect(connectionAvailable(status, "openai-api")).toBe(true);
    expect(connectionAvailable(status, "openai-chatgpt")).toBe(false);
  });
  it("ignores unrelated streams and sends explicit history/context without credentials", async () => {
    const { bridge, request, emit } = fixture();
    bridge.generate = vi.fn(async (id, sent) => {
      expect(sent.messages).toEqual([{ role: "user", content: "Question" }]);
      expect(sent.instructions).toContain("Selected source");
      expect(JSON.stringify(sent)).not.toContain("access_token");
      emit({ requestId: "unrelated", type: "token", content: "Wrong" });
      emit({ requestId: id, type: "token", content: "Answer" });
      emit({ requestId: id, type: "done" });
    });
    const events = [];
    for await (const event of new OpenAIProvider("openai-api", bridge).generate(request)) events.push(event);
    expect(events.map((e) => e.type)).toEqual(["token", "done"]);
  });
  it("does not treat a disconnected stream as successful completion", async () => {
    const { bridge, request } = fixture();
    await expect(new OpenAIProvider("openai-api", bridge).generate(request).next()).rejects.toThrow("did not confirm");
  });
  it("waits for cancellation of the native request and preserves abort semantics", async () => {
    const { bridge, request, emit } = fixture(); const controller = new AbortController();
    let started!: () => void; const ready = new Promise<void>((resolve) => { started = resolve; });
    let end!: () => void; const pending = new Promise<void>((resolve) => { end = resolve; });
    bridge.generate = vi.fn(async (id) => { emit({ requestId: id, type: "start" }); started(); await pending; });
    bridge.cancel = vi.fn(async () => { end(); });
    const stream = new OpenAIProvider("openai-api", bridge).generate(request, controller.signal);
    const first = stream.next(); await ready; await first; controller.abort();
    await expect(stream.next()).rejects.toMatchObject({ name: "AbortError" });
    expect(bridge.cancel).toHaveBeenCalledOnce();
  });
});
