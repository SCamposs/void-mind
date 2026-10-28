import { spawn } from "node:child_process";
import process from "node:process";
import console from "node:console";
import { setTimeout, clearTimeout } from "node:timers";
import { createInterface } from "node:readline";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Explicit diagnostic: prints only phase/status and bounded runtime errors.
// Does not read auth files, print account/model payloads or submit a user turn.
const [executable, directory, sandbox] = process.argv.slice(2);
if (sandbox && sandbox !== "mxc") throw new Error("Only the explicit MXC diagnostic override is supported.");
if (!executable || !directory) throw new Error("Usage: node scripts/probe-codex.mjs <codex.exe> <neutral-workspace>");
const cwd = resolve(directory);
await mkdir(cwd, { recursive: true });
const child = spawn(executable, ["app-server", "--stdio"], { cwd, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
child.stderr.resume();
let id = 0;
const pending = new Map();
const lines = createInterface({ input: child.stdout });
lines.on("line", (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timer);
  if (message.error) request.reject(new Error(String(message.error.message ?? "Protocol request rejected").slice(0, 1000)));
  else request.resolve(message.result);
});
child.on("error", (error) => {
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); }
  pending.clear();
});
function request(method, params) {
  return new Promise((resolveRequest, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`${method} timed out`)); }, 20000);
    pending.set(requestId, { resolve: resolveRequest, reject, timer });
    child.stdin.write(`${JSON.stringify({ id: requestId, method, params })}\n`);
  });
}
let phase = "initialize";
try {
  await request("initialize", { clientInfo: { name: "void_mind_probe", version: "1.0.0" }, capabilities: null });
  child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
  console.log("initialize: accepted");
  phase = "model/list";
  const catalog = await request("model/list", { limit: 100 });
  const model = catalog.data?.find((item) => item.isDefault) ?? catalog.data?.[0];
  if (!model) throw new Error("No model returned by runtime");
  console.log("model/list: available");
  phase = "thread/start";
  await request("thread/start", {
    model: model.id, cwd, approvalPolicy: "never", ephemeral: true,
    baseInstructions: "Answer general questions directly. Do not use tools, files, shell or project access.",
    config: {
      ...(sandbox ? { windows: { sandbox } } : {}),
      default_permissions: "void_mind",
      permissions: { void_mind: {
        description: "Isolated general-purpose conversation",
        filesystem: { ":minimal": "read", [cwd]: "read" }, network: { enabled: false }
      } }
    }
  });
  console.log("thread/start: accepted (no inference attempted)");
} catch (error) {
  console.error(`${phase}: ${error.message}`);
  process.exitCode = 1;
} finally {
  lines.close();
  child.stdin.end();
  child.kill();
  child.stdout.destroy();
  child.stderr.destroy();
}
