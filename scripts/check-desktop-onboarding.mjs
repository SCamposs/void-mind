/* global fetch, AbortSignal */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFile, spawn } from "node:child_process";
import console from "node:console";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";
import { promisify } from "node:util";

// Real Linux desktop acceptance on a disposable CI runner. No user profile,
// credentials, authentication, imported personal files or inference requests.
if (process.platform !== "linux" || process.env.CI !== "true") {
  throw new Error("Run this desktop check only on an isolated Linux CI runner.");
}
const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, process.env.VOID_MIND_E2E_OUTPUT ?? "private/qa/onboarding-e2e");
const application = process.env.VOID_MIND_E2E_APP ?? join(root, "apps/desktop/src-tauri/target/release/void-mind-desktop");
const applicationKind = process.env.VOID_MIND_E2E_KIND ?? "unbundled";
const profile = await mkdtemp(join(tmpdir(), "void-mind-onboarding-"));
await mkdir(output, { recursive: true });
const profileEnv = {};
for (const kind of ["DATA", "CONFIG", "CACHE"]) {
  profileEnv[`XDG_${kind}_HOME`] = join(profile, kind.toLowerCase());
  await mkdir(profileEnv[`XDG_${kind}_HOME`], { recursive: true });
}
const reducedMotion = process.env.VOID_MIND_E2E_REDUCED_MOTION === "1";
if (reducedMotion) {
  const gtkConfig = join(profileEnv.XDG_CONFIG_HOME, "gtk-3.0");
  await mkdir(gtkConfig, { recursive: true });
  await writeFile(join(gtkConfig, "settings.ini"), "[Settings]\ngtk-enable-animations=false\n");
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
let importNumber = 0;
const runFile = promisify(execFile);
const source = join(profile, "acceptance-notes.md");
const sourceContent = "# Acceptance notes\nSynthetic, explicitly selected workspace context.\n";
await writeFile(source, sourceContent);

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
async function keys(...values) {
  await command("POST", `/session/${session}/actions`, {
    actions: [{ type: "key", id: "keyboard", actions: [
      ...values.map(value => ({ type: "keyDown", value })),
      ...values.toReversed().map(value => ({ type: "keyUp", value }))
    ] }]
  });
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
      "tauri:options": { application }
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
async function importedItem() {
  return evaluate("return JSON.parse(localStorage.getItem('void-mind:state')).state.knowledge.find(item => item.sourceFilename === 'acceptance-notes.md') ?? null;");
}
async function importSource() {
  importNumber++;
  await click("Import source");
  // This runner has a dedicated Xvfb display and no user desktop. Operate only
  // the visible GTK file chooser opened by the product's real import action.
  const dialog = await until("native GTK file chooser", async () => {
    const { stdout } = await runFile("xdotool", ["search", "--onlyvisible", "--name", "^(Open|Open File|Select a file)$"], { timeout: 5000 });
    const windows = stdout.trim().split(/\s+/).filter(Boolean);
    assert.equal(windows.length, 1, "Select exactly one native file chooser");
    return windows[0];
  });
  assert.match(dialog, /^\d+$/);
  // GTK may map the chooser before its location entry is ready for key events.
  await delay(500);
  await runFile("xdotool", ["windowfocus", "--sync", dialog], { timeout: 5000 });
  await runFile("scrot", [join(output, `picker-${importNumber}-open.png`)], { timeout: 5000 });
  await runFile("xdotool", ["key", "--clearmodifiers", "ctrl+l"], { timeout: 5000 });
  await delay(250);
  await runFile("xdotool", ["type", "--clearmodifiers", "--", source], { timeout: 5000 });
  await runFile("scrot", [join(output, `picker-${importNumber}-path.png`)], { timeout: 5000 });
  await runFile("xdotool", ["key", "--clearmodifiers", "Return"], { timeout: 5000 });
  await delay(500);
  await runFile("scrot", [join(output, `picker-${importNumber}-located.png`)], { timeout: 5000 });
  // GTK's location entry resolves the path first, enabling its Open action.
  // Confirm that native action rather than treating the first Enter as import.
  if (!await importedItem()) {
    await runFile("xdotool", ["windowfocus", "--sync", dialog], { timeout: 5000 });
    await runFile("xdotool", ["key", "--clearmodifiers", "alt+o"], { timeout: 5000 });
    await delay(500);
  }
  await runFile("scrot", [join(output, `picker-${importNumber}-submitted.png`)], { timeout: 5000 });
  const item = await until("imported knowledge metadata", importedItem);
  assert.ok(item.managedPath.startsWith(profileEnv.XDG_DATA_HOME + "/"));
  assert.notEqual(item.managedPath, source);
  assert.equal(item.type, "markdown");
  assert.equal(item.status, "ready");
  assert.equal(await readFile(item.managedPath, "utf8"), sourceContent);
  assert.equal(await readFile(source, "utf8"), sourceContent);
  return item;
}
async function assertCopyRemoved(item) {
  await until("managed copy removed", async () => {
    try { await access(item.managedPath); return false; }
    catch (error) { if (error.code === "ENOENT") return true; throw error; }
  });
  assert.equal(await readFile(source, "utf8"), sourceContent);
}
async function receipt(status, error) {
  await writeFile(join(output, "receipt.json"), JSON.stringify({
    status, platform: process.platform, applicationKind, reducedMotion,
    commit: process.env.GITHUB_SHA, checks, ...(error ? { error: error.message } : {})
  }, null, 2));
}

try {
  await until("tauri-driver readiness", async () => (await command("GET", "/status"))?.ready !== false);
  await startSession();
  await heading("Your space to think with intelligence.");
  await button("Continue with ChatGPT");
  await button("Use a local model");
  await button("Use API key");
  if (reducedMotion) {
    assert.equal(await evaluate("return matchMedia('(prefers-reduced-motion: reduce)').matches;"), true);
    assert.equal(await evaluate("return getComputedStyle(document.querySelector('.onboarding-actions button')).animationDuration;"), "0.001s");
    checks.push("Native GTK reduced-motion preference reaches WebKit and the application's reduced-motion stylesheet.");
  }
  await screenshot("01-first-run");
  checks.push("Fresh native first run exposes ChatGPT and explicit alternatives without credentials.");

  await click("Explore first");
  await heading("Make room for thought.");
  const prompt = await element("css selector", "textarea[aria-label='Start a conversation']");
  await command("POST", `/session/${session}/element/${prompt}/value`, { text: "Synthetic prompt; must not be submitted." });
  const start = await element("css selector", "button[aria-label='Start conversation']");
  assert.equal(await command("GET", `/session/${session}/element/${start}/enabled`), false);
  await command("POST", `/session/${session}/element/${prompt}/value`, { text: "\uE007" });
  await heading("Make room for thought.");
  assert.equal(await evaluate("return JSON.parse(localStorage.getItem('void-mind:state')).state.conversations.length;"), 0);
  await screenshot("02-explore-home");
  checks.push("Explore first opens Home; a nonempty prompt cannot be sent by button or Enter without a provider, and no conversation is persisted.");

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
  await evaluate("window.__voidMindFocusBeforeSwitcher = document.activeElement; return true;");
  await keys("\uE009", "k");
  await until("quick switcher input focus", () => evaluate("return document.activeElement?.getAttribute('aria-label') === 'Search destinations, workspaces, and conversations';"));
  await keys("\uE00C");
  await until("switcher closes and restores focus", () => evaluate("return !document.querySelector('.quick-switcher') && document.activeElement === window.__voidMindFocusBeforeSwitcher;"));
  await keys("\uE009", "k");
  const search = await element("css selector", "input[aria-label='Search destinations, workspaces, and conversations']");
  await command("POST", `/session/${session}/element/${search}/value`, { text: "CI workspace" });
  await button("CI workspace");
  for (let tab = 0; tab < 6 && !await evaluate("return document.activeElement?.textContent === 'CI workspace';"); tab++) {
    await keys("\uE004");
  }
  assert.equal(await evaluate("return document.activeElement?.textContent;"), "CI workspace");
  await keys("\uE007");
  await until("workspace switcher navigation", () => evaluate("return !document.querySelector('.quick-switcher') && document.querySelector('.workspace-editor input')?.value === 'CI workspace';"));
  await keys("\uE009", ",");
  await heading("Settings");
  await click("Workspaces");
  checks.push("Ctrl+K focuses search, Escape restores focus, Tab/Enter opens a matching workspace and Ctrl+comma opens Settings.");

  await click("Knowledge");
  await heading("Knowledge");
  const imported = await importSource();
  await click("View full source");
  await until("visible full source preview", () => evaluate("const panel = document.querySelector('.knowledge-preview .void-disclosure-panel'); return document.querySelector('.knowledge-preview pre')?.textContent === arguments[0] && panel?.getBoundingClientRect().height > 30 && getComputedStyle(panel).opacity === '1';", [sourceContent]));
  await screenshot("05-knowledge-imported");
  checks.push("A Markdown source selected through the native file chooser creates a real managed copy, metadata and full preview without changing the original.");
  await closeSession();
  await startSession();
  await until("boot completion and persisted onboarding", () => evaluate("return !document.querySelector('.onboarding-screen') && !!document.querySelector('.app-root-surface:not([inert]) nav');"));
  await click("Workspaces");
  await until("persisted instructions", () => evaluate("return document.querySelector('.workspace-editor textarea[rows=\"8\"]')?.value === 'Synthetic native acceptance instructions.';"));
  checks.push("Workspace creation, rename, instructions and onboarding completion survive an actual app-session restart.");

  await click("Knowledge");
  await heading("Knowledge");
  assert.equal((await importedItem()).id, imported.id);
  assert.equal(await readFile(imported.managedPath, "utf8"), sourceContent);
  const remove = () => element("css selector", "button[aria-label='Remove acceptance-notes']");
  await command("POST", `/session/${session}/element/${await remove()}/click`, {});
  await click("No");
  assert.equal((await importedItem()).id, imported.id);
  assert.equal(await readFile(imported.managedPath, "utf8"), sourceContent);
  await command("POST", `/session/${session}/element/${await remove()}/click`, {});
  await click("Yes");
  await until("knowledge catalog removal", async () => !await importedItem());
  await assertCopyRemoved(imported);
  checks.push("Knowledge survives app restart; cancelling removal keeps the copy, while confirmed removal deletes only the managed copy and metadata.");
  const workspaceSource = await importSource();
  await click("Workspaces");

  await click("New conversation");
  await heading("New conversation");
  await keys("\uE009", "n");
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
  await assertCopyRemoved(workspaceSource);
  assert.equal(await importedItem(), null);
  checks.push("Deleting the synthetic workspace cleans its managed Knowledge copy and metadata while preserving the selected original Markdown file.");

  await command("POST", `/session/${session}/window/rect`, { width: 760, height: 600 });
  await until("native compact viewport", () => evaluate("return innerWidth >= 720 && innerWidth <= 780 && innerHeight <= 600 && !document.querySelector('#primary-navigation');"));
  const home = await element("css selector", "button[aria-label='Open Home']");
  await command("POST", `/session/${session}/element/${home}/click`, {});
  await heading("Make room for thought.");
  assert.equal(await evaluate("return document.documentElement.scrollWidth <= innerWidth && document.querySelector('.home-composer').getBoundingClientRect().right <= innerWidth;"), true);
  await screenshot("06-compact-home");
  const menu = await element("css selector", "button[aria-label='Open navigation']");
  await command("POST", `/session/${session}/element/${menu}/click`, {});
  await until("compact navigation drawer", () => evaluate("return !!document.querySelector('#primary-navigation.is-open');"));
  await screenshot("07-compact-navigation");
  for (let tab = 0; tab < 8; tab++) {
    await keys("\uE004");
    await until(`drawer focus after Tab ${tab + 1}`, () => evaluate("return !!document.activeElement?.closest('#primary-navigation');"), 1000);
  }
  await keys("\uE00C");
  await until("compact drawer closes and returns focus", () => evaluate("return !document.querySelector('#primary-navigation') && document.activeElement?.getAttribute('aria-label') === 'Open navigation';"));
  checks.push("A real compact native window keeps Home within its viewport; the navigation drawer contains keyboard focus and Escape restores focus to its trigger.");
  await receipt("passed");
  checks.forEach(check => console.log(`PASS: ${check}`));
} catch (error) {
  await receipt("failed", error);
  if (session) await screenshot("failure").catch(() => undefined);
  console.error(driverLog);
  throw error;
} finally {
  await closeSession().catch(error => console.error(`Session cleanup: ${error.message}`));
  driver.kill();
  await Promise.race([new Promise(resolveExit => driver.once("exit", resolveExit)), delay(2000)]);
  if (driver.exitCode === null) driver.kill("SIGKILL");
}
