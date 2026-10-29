/* global fetch, AbortSignal */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import console from "node:console";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";

// Real Linux desktop acceptance on a disposable CI runner. No user profile,
// credentials, authentication, imported personal files or inference requests.
if (process.platform !== "linux" || process.env.CI !== "true") {
  throw new Error("Run this desktop check only on an isolated Linux CI runner.");
}
const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "private/qa/onboarding-e2e");
const profile = await mkdtemp(join(tmpdir(), "void-mind-onboarding-"));
await mkdir(output, { recursive: true });
const profileEnv = {};
for (const kind of ["DATA", "CONFIG", "CACHE"]) {
  profileEnv[`XDG_${kind}_HOME`] = join(profile, kind.toLowerCase());
  await mkdir(profileEnv[`XDG_${kind}_HOME`], { recursive: true });
}
const driver = spawn("tauri-driver", [], {
  env: { ...process.env, ...profileEnv },
  stdio: ["ignore", "ignore", "pipe"]
});
let driverError;
let driverLog = "";
driver.on("error", error => { driverError = error; });
driver.stderr.on("data", chunk => { driverLog = (driverLog + chunk.toString()).slice(-8000); });
let session;
const checks = [];

async function command(method, path, body) {
  const response = await fetch(`http://127.0.0.1:4444${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000)
  });
  const result = await response.json();
  if (!response.ok || result.value?.error) {
    throw new Error(`${method} ${path}: ${result.value?.error ?? response.status}: ${result.value?.message ?? ""}`);
  }
  return result.value;
}
async function until(label, probe, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    if (driverError) throw driverError;
    try {
      const result = await probe();
      if (result) return result;
    } catch (error) { last = error; }
    await delay(250);
  }
  throw new Error(`Timed out: ${label}. ${last?.message ?? ""}`);
}
async function element(using, value) {
  const found = await command("POST", `/session/${session}/element`, { using, value });
  return found["element-6066-11e4-a52e-4f735466cecf"];
}
async function button(name) {
  return until(`button ${name}`, () => element("xpath", `//button[normalize-space(.)='${name}']`));
}
async function click(name) {
  await command("POST", `/session/${session}/element/${await button(name)}/click`, {});
}
async function evaluate(script, args = []) {
  return command("POST", `/session/${session}/execute/sync`, { script, args });
}
async function heading(text) {
  await until(`heading ${text}`, () => evaluate("return [...document.querySelectorAll('h1')].some(e => e.textContent.trim() === arguments[0]);", [text]));
}
async function screenshot(name) {
  const pixels = await command("GET", `/session/${session}/screenshot`);
  await writeFile(join(output, `${name}.png`), Buffer.from(pixels, "base64"));
}
async function startSession() {
  const created = await command("POST", "/session", {
    capabilities: { alwaysMatch: {
      browserName: "wry",
      "tauri:options": { application: join(root, "apps/desktop/src-tauri/target/release/void-mind-desktop") }
    } }
  });
  session = created.sessionId;
  assert.ok(session, "WebDriver must create a real application session");
}
async function closeSession() {
  if (session) {
    await command("DELETE", `/session/${session}`);
    session = undefined;
  }
}
async function setField(label, text) {
  const id = await element("xpath", `//label[span[normalize-space(.)='${label}']]//*[self::input or self::textarea]`);
  await command("POST", `/session/${session}/element/${id}/clear`, {});
  await command("POST", `/session/${session}/element/${id}/value`, { text });
}

try {
  await until("tauri-driver readiness", async () => (await command("GET", "/status"))?.ready !== false);
  await startSession();
  await heading("Your space to think with intelligence.");
  await button("Continue with ChatGPT");
  await button("Use a local model");
  await button("Use API key");
  await screenshot("01-first-run");
  checks.push("Fresh native first run exposes ChatGPT and explicit alternatives without credentials.");

  await click("Explore first");
  await heading("Make room for thought.");
  const prompt = await element("css selector", "textarea[aria-label='Start a conversation']");
  await command("POST", `/session/${session}/element/${prompt}/value`, { text: "Synthetic prompt; must not be submitted." });
  const start = await element("css selector", "button[aria-label='Start conversation']");
  assert.equal(await command("GET", `/session/${session}/element/${start}/enabled`), false);
  await screenshot("02-explore-home");
  checks.push("Explore first opens Home; generation is unavailable without a configured provider.");

  await click("Intelligence");
  await heading("Intelligence");
  await button("Check local runtime");
  checks.push("Intelligence opens without a configured provider or installed Codex requirement.");

  await click("Workspaces");
  await heading("Workspaces");
  await click("New workspace");
  await until("workspace editor", () => element("css selector", ".workspace-editor"));
  await setField("Name", "CI workspace");
  await setField("Instructions", "Synthetic native acceptance instructions.");
  await click("Save changes");
  await until("saved workspace", () => evaluate("return [...document.querySelectorAll('.workspace-list strong')].some(e => e.textContent === 'CI workspace');"));
  await screenshot("03-workspace");
  await closeSession();
  await startSession();
  await until("boot completion and persisted onboarding", () => evaluate("return !document.querySelector('.onboarding-screen') && !!document.querySelector('.app-root-surface:not([inert]) nav');"));
  await click("Workspaces");
  await until("persisted instructions", () => evaluate("return document.querySelector('.workspace-editor textarea[rows=\"8\"]')?.value === 'Synthetic native acceptance instructions.';"));
  checks.push("Workspace creation, rename, instructions and onboarding completion survive an actual app-session restart.");

  await click("New conversation");
  await heading("New conversation");
  assert.equal(await evaluate("return JSON.parse(localStorage.getItem('void-mind:state')).state.conversations.length;"), 0);
  const send = await element("css selector", "button[aria-label='Send message']");
  assert.equal(await command("GET", `/session/${session}/element/${send}/enabled`), false);
  const composer = await element("css selector", "textarea[placeholder='Configure Intelligence to begin']");
  assert.equal(await command("GET", `/session/${session}/element/${composer}/enabled`), false);
  checks.push("A workspace draft does not create an empty persisted conversation and cannot send without a model.");

  await click("Workspaces");
  await click("Delete workspace");
  await button("Keep");
  await click("Keep");
  assert.equal(await evaluate("return JSON.parse(localStorage.getItem('void-mind:state')).state.workspaces.length;"), 1);
  await click("Delete workspace");
  await click("Delete");
  await until("workspace removal", () => evaluate("return document.querySelector('.workspace-list')?.textContent.includes('No workspaces yet.');"));
  await screenshot("04-workspace-deleted");
  checks.push("Synthetic workspace deletion requires confirmation; Keep preserves it and Delete removes it.");
  await writeFile(join(output, "receipt.json"), JSON.stringify({ platform: process.platform, checks }, null, 2));
  checks.forEach(check => console.log(`PASS: ${check}`));
} catch (error) {
  if (session) await screenshot("failure").catch(() => undefined);
  console.error(driverLog);
  throw error;
} finally {
  await closeSession().catch(error => console.error(`Session cleanup: ${error.message}`));
  driver.kill();
  await Promise.race([new Promise(resolveExit => driver.once("exit", resolveExit)), delay(2000)]);
  if (driver.exitCode === null) driver.kill("SIGKILL");
}
