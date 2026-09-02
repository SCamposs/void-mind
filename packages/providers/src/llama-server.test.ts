import { describe, expect, it, vi } from "vitest";
import { DEFAULT_GENERATION_SETTINGS } from "@void-mind/mind-core";
import {
  LlamaServerProvider,
  SseDecoder,
  normalizeLoopbackEndpoint,
  parseLlamaEvent
} from "./llama-server";

describe("llama-server provider", () => {
  it("accepts only loopback HTTP origins", () => {
    expect(normalizeLoopbackEndpoint("http://127.0.0.1:8080/")).toBe("http://127.0.0.1:8080");
    expect(() => normalizeLoopbackEndpoint("https://example.com")).toThrow("HTTP");
    expect(() => normalizeLoopbackEndpoint("http://192.168.1.2:8080")).toThrow("loopback");
  });

  it("decodes split SSE chunks and errors", () => {
    const decoder = new SseDecoder();
    expect(decoder.push('data: {"choices":[{"delta":{"content":"Hel')).toEqual([]);
    const events = decoder.push('lo"}}]}\n\ndata: [DONE]\n\n');
    expect(parseLlamaEvent(events[0])).toEqual({ type: "token", content: "Hello" });
    expect(parseLlamaEvent(events[1])).toEqual({ type: "done" });
    expect(parseLlamaEvent("{")).toMatchObject({ type: "error" });
  });

  it("reports health and discovers the loaded model", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("/health")
        ? new Response('{"status":"ok"}')
        : new Response('{"data":[{"id":"local-model"}]}')
    );
    const provider = new LlamaServerProvider("http://localhost:8080", fetcher as typeof fetch);
    await expect(provider.health()).resolves.toMatchObject({
      ok: true,
      state: "ready",
      modelIdentifier: "local-model"
    });
  });

  it("reports model loading and HTTP failures clearly", async () => {
    const loading = new LlamaServerProvider(
      "http://127.0.0.1:8080",
      vi.fn(async () => new Response("", { status: 503 })) as typeof fetch
    );
    await expect(loading.health()).resolves.toMatchObject({
      ok: false,
      state: "loading"
    });
    const failed = new LlamaServerProvider(
      "http://127.0.0.1:8080",
      vi.fn(async () => new Response("Unavailable", { status: 500 })) as typeof fetch
    );
    await expect(failed.health()).resolves.toMatchObject({
      ok: false,
      state: "offline"
    });
  });

  it("streams tokens and declares local capabilities", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n')
        );
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      }
    });
    const provider = new LlamaServerProvider(
      "http://127.0.0.1:8080",
      vi.fn(async () => new Response(stream)) as typeof fetch
    );
    const events = [];
    for await (const event of provider.generate({
      messages: [],
      model: {
        id: "model",
        displayName: "Model",
        identifier: "model",
        version: "A0",
        providerId: "void-local",
        location: "local",
        languages: [],
        capabilities: []
      },
      settings: DEFAULT_GENERATION_SETTINGS
    })) {
      events.push(event);
    }
    expect(events.map((event) => event.type)).toEqual(["start", "token", "done"]);
    expect(provider.capabilities).toMatchObject({
      streaming: true,
      cancellation: true,
      local: true,
      tools: false
    });
  });

  it("aborts an active generation when cancelled", async () => {
    let notifyStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    let observedSignal: AbortSignal | undefined;
    const provider = new LlamaServerProvider(
      "http://127.0.0.1:8080",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        observedSignal = init?.signal ?? undefined;
        notifyStarted();
        return await new Promise<Response>((_resolve, reject) => {
          observedSignal?.addEventListener(
            "abort",
            () => reject(observedSignal?.reason),
            { once: true }
          );
        });
      }) as typeof fetch
    );
    const iterator = provider.generate({
      messages: [],
      model: {
        id: "model",
        displayName: "Model",
        identifier: "model",
        version: "A0",
        providerId: "void-local",
        location: "local",
        languages: [],
        capabilities: []
      },
      settings: DEFAULT_GENERATION_SETTINGS
    });
    const pending = iterator.next();
    await started;
    provider.cancel();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(observedSignal?.aborted).toBe(true);
  });
});
