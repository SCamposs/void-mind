"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const L = require("./release-lib.cjs");
const G = require("./check-security.cjs");
const root = path.resolve(__dirname, "../..");
const release = fs.readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");
test("repository workflow policy and existing public updater identity", () => G.checkRepository(root));
test("rejects broad key scope, unpinned actions and malicious signer commands", () => {
  for (const bad of [
    release.replace("    environment: release-signing", "    environment: release-signing\n    env:\n      LEAK: $" + "{{ secrets.TAURI_SIGNING_PRIVATE_KEY }}"),
    release.replace("node .github/scripts/release.cjs verify metadata/release-metadata.json signed", "npm run build"),
    release.replace("3d3c42e5aac5ba805825da76410c181273ba90b1", "v7"),
    release.replace("    environment: release-signing", "    environment: general-build"),
    release.replace("    default: true", "    default: false"),
  ].filter(s => s !== release)) assert.throws(() => G.checkWorkflow("release.yml", bad));
});
test("rejects duplicate YAML mappings rather than interpreting a safe-looking copy", () => {
  assert.throws(() => G.parse("permissions:\n  contents: read\npermissions:\n  contents: write\n"));
});
test("release tags are literal SemVer, not branches, shell syntax or revision expressions", () => {
  for (const tag of ["main", "v1.2.3^{commit}", "v1.2.3;whoami", "v1.2.3\nmain", "v01.2.3", "v1.2.3-alpha.01", "../main"]) assert.throws(() => L.validateTag(tag));
  assert.equal(L.validateTag("v1.2.3-alpha.2"), "v1.2.3-alpha.2");
});
test("preserves ordinary VOID versioning and Mind numeric-alpha native mapping", () => {
  const make = (kind, version, native) => {
    const p = { ...L.policy, versionKind: kind };
    const cfg = { version: native, plugins: { updater: { pubkey: p.pubkey, endpoints: ["https://raw.githubusercontent.com/" + p.repository + "/main/updater/latest.json"] } } };
    return L.makeMetadata("v" + version, cfg, { version }, "a".repeat(40), "Notes", p);
  };
  assert.equal(make("tag", "0.3.0-alpha", "0.3.0-alpha").version, "0.3.0-alpha");
  assert.equal(make("numeric-alpha", "0.2.0-alpha.2", "0.2.0-2").version, "0.2.0-2");
  assert.throws(() => make("numeric-alpha", "0.2.0-alpha.2", "0.2.0-alpha.2"));
});
test("rejects public-key rotation or altered updater endpoints", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, L.policy.desktop, "src-tauri/tauri.conf.json"), "utf8"));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, L.policy.desktop, "package.json"), "utf8"));
  const tag = "v" + pkg.version;
  for (const field of ["pubkey", "endpoints"]) {
    const altered = structuredClone(cfg); altered.plugins.updater[field] = field === "pubkey" ? "different" : ["https://example.invalid"];
    assert.throws(() => L.makeMetadata(tag, altered, pkg, "a".repeat(40), "Notes"));
  }
});
test("rejects extra files, nested content and symlink artifacts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "artifact-allowlist-"));
  try {
    fs.writeFileSync(path.join(dir, "expected"), "bytes");
    L.assertFiles(dir, ["expected"]);
    fs.writeFileSync(path.join(dir, "extra"), "unexpected");
    assert.throws(() => L.assertFiles(dir, ["expected"]));
    fs.unlinkSync(path.join(dir, "extra"));
    fs.mkdirSync(path.join(dir, "extra"));
    assert.throws(() => L.assertFiles(dir, ["expected", "extra"]));
    fs.rmdirSync(path.join(dir, "extra"));
    if (process.platform !== "win32") {
      fs.symlinkSync(path.join(dir, "expected"), path.join(dir, "extra"));
      assert.throws(() => L.assertFiles(dir, ["expected", "extra"]));
    }
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("rejects feed downgrade and replacement of an already installed version", () => {
  const current = { version: "0.2.0-2", platforms: { signed: "old" } };
  assert.throws(() => L.assertFeedAdvance(current, { version: "0.2.0-1", platforms: {} }));
  assert.throws(() => L.assertFeedAdvance(current, { version: "0.2.0-2", platforms: { signed: "new" } }));
  assert.equal(L.assertFeedAdvance(current, structuredClone(current)), false);
  assert.equal(L.assertFeedAdvance(current, { version: "0.2.0-3", platforms: {} }), true);
});
test("sensitive filenames are ignored while examples and public keys remain visible", () => {
  for (const file of [".env", "nested/.env.production", "signing.key", "nested/signing.key", "credentials.json", "cert.pfx"]) {
    const r = spawnSync("git", ["check-ignore", "--no-index", file], { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0, "Missing ignore: " + file);
  }
  for (const file of [".env.example", "nested/.env.example", "signing.key.pub", "update.sig"]) {
    const r = spawnSync("git", ["check-ignore", "--no-index", file], { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 1, "Public fixture unexpectedly hidden: " + file);
  }
});
test("real detector rejects a synthetic token without disclosing it", { skip: !process.env.GITLEAKS_PATH }, () => {
  const secret = ["gh", "p_", "aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4"].join("");
  const r = spawnSync(process.env.GITLEAKS_PATH, ["stdin", "--redact", "--no-banner"], { input: "credential=" + secret, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.ok(!(r.stdout + r.stderr).includes(secret), "Detector must redact matches");
});

test("real Ed25519/minisign verification rejects payload, comment and key tampering", () => {
  const crypto = require("node:crypto");
  const pair = crypto.generateKeyPairSync("ed25519");
  const id = Buffer.from("0102030405060708", "hex");
  const rawPublic = pair.publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const pub = Buffer.from("untrusted comment: fixture public key\n" + Buffer.concat([Buffer.from("Ed"), id, rawPublic]).toString("base64") + "\n").toString("base64");
  const data = Buffer.from("release package fixture");
  const digest = crypto.createHash("blake2b512").update(data).digest();
  const signature = crypto.sign(null, digest, pair.privateKey);
  const comment = "fixture trusted comment";
  const text = [
    "untrusted comment: fixture signature",
    Buffer.concat([Buffer.from("ED"), id, signature]).toString("base64"),
    "trusted comment: " + comment,
    crypto.sign(null, Buffer.concat([signature, Buffer.from(comment)]), pair.privateKey).toString("base64")
  ].join("\n") + "\n";
  const encoded = Buffer.from(text).toString("base64");
  L.verifySignature(data, encoded, pub);
  assert.throws(() => L.verifySignature(Buffer.from("modified"), encoded, pub));
  assert.throws(() => L.verifySignature(data, Buffer.from(text.replace(comment, "changed")).toString("base64"), pub));
  const corrupt = Buffer.from(Buffer.from(text.split("\n")[1], "base64")); corrupt[2] ^= 1;
  assert.throws(() => L.verifySignature(data, Buffer.from(text.replace(text.split("\n")[1], corrupt.toString("base64"))).toString("base64"), pub));
});
test("package routing cannot change origin, signature or the installed format", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, L.policy.desktop, "src-tauri/tauri.conf.json"), "utf8"));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, L.policy.desktop, "package.json"), "utf8"));
  const meta = L.makeMetadata("v" + pkg.version, cfg, pkg, "a".repeat(40), "Notes");
  const signatures = Object.fromEntries(L.packageNames().map(n => [n, "fixture"]));
  const feed = L.manifest(meta, signatures);
  L.verifyManifest(feed, meta, signatures);
  for (const mutate of [
    f => { f.platforms["linux-x86_64-deb"].url = f.platforms["linux-x86_64-appimage"].url; },
    f => { f.platforms["windows-x86_64"].url = "https://example.invalid/package"; },
    f => { f.platforms["windows-x86_64"].signature = "changed"; }
  ]) { const bad = structuredClone(feed); mutate(bad); assert.throws(() => L.verifyManifest(bad, meta, signatures)); }
});
test("prepare accepts an existing main ancestor and rejects a tag outside trusted main", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-trust-"));
  const git = (...args) => L.run("git", ["-C", dir, ...args]);
  try {
    git("init", "--initial-branch=main");
    git("config", "user.name", "Fixture");
    git("config", "user.email", "fixture@users.noreply.github.com");
    const cfg = JSON.parse(fs.readFileSync(path.join(root, L.policy.desktop, "src-tauri/tauri.conf.json"), "utf8"));
    const pkg = JSON.parse(fs.readFileSync(path.join(root, L.policy.desktop, "package.json"), "utf8"));
    fs.mkdirSync(path.join(dir, L.policy.desktop, "src-tauri"), { recursive: true });
    fs.mkdirSync(path.join(dir, "docs/releases"), { recursive: true });
    fs.writeFileSync(path.join(dir, L.policy.desktop, "src-tauri/tauri.conf.json"), JSON.stringify(cfg));
    fs.writeFileSync(path.join(dir, L.policy.desktop, "package.json"), JSON.stringify(pkg));
    const tag = "v" + pkg.version;
    fs.writeFileSync(path.join(dir, "docs/releases", tag + ".md"), "Fixture release notes");
    git("add", "."); git("commit", "-m", "fixture base");
    git("tag", "-a", tag, "-m", "fixture release");
    const sha = git("rev-parse", "HEAD");
    git("update-ref", "refs/remotes/origin/main", sha);
    const env = { ...process.env, GITHUB_REPOSITORY: L.policy.repository, GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main" };
    delete env.GITHUB_OUTPUT;
    const invoke = () => spawnSync(process.execPath, [path.join(__dirname, "release.cjs"), "prepare", tag], { cwd: dir, env, encoding: "utf8" });
    assert.equal(invoke().status, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "metadata/release-metadata.json"))).sourceSha, sha);
    git("switch", "--orphan", "untrusted");
    git("commit", "--allow-empty", "-m", "unrelated history");
    git("update-ref", "refs/remotes/origin/main", git("rev-parse", "HEAD"));
    assert.notEqual(invoke().status, 0);
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test("publisher preserves existing assets and proposes only a reviewed feed change", () => {
  const { publish } = require("./publish-release.cjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-publisher-"));
  const oldRepository = process.env.GITHUB_REPOSITORY;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, L.policy.desktop, "src-tauri/tauri.conf.json"), "utf8"));
    const pkg = JSON.parse(fs.readFileSync(path.join(root, L.policy.desktop, "package.json"), "utf8"));
    const meta = L.makeMetadata("v" + pkg.version, cfg, pkg, "a".repeat(40), "Fixture notes");
    const feed = L.manifest(meta, Object.fromEntries(L.packageNames().map(n => [n, "fixture"])));
    fs.writeFileSync(path.join(dir, "latest.json"), JSON.stringify(feed));
    for (const n of L.packageNames()) for (const suffix of ["", ".sig", ".sha256"]) fs.writeFileSync(path.join(dir, n + suffix), "fixture");
    const assets = fs.readdirSync(dir).map(name => ({ name, digest: "sha256:" + L.sha256(fs.readFileSync(path.join(dir, name))) }));
    const repo = "repos/" + L.policy.repository;
    process.env.GITHUB_REPOSITORY = L.policy.repository;
    const simulate = ({ wrongDigest = false, unrelated = false, exact = false } = {}) => {
      const calls = [];
      const stub = { ...L, verifySigned: () => {}, run: (command, args, options) => {
        assert.equal(command, "gh"); calls.push(args);
        if (args[0] === "pr") return args[1] === "list" ? "[]" : "https://example.invalid/feed-pr";
        assert.equal(args[0], "api", "No release edit/upload for already published assets");
        const endpoint = args[1];
        let response;
        if (endpoint.startsWith(repo + "/contents/updater/latest.json?")) response = { sha: "blob", content: Buffer.from(JSON.stringify(exact ? feed : { version: "0.1.0", platforms: {} })).toString("base64") };
        else if (endpoint === repo + "/git/ref/tags/" + meta.tag) response = { object: { type: "tag", sha: "tag-id" } };
        else if (endpoint === repo + "/git/tags/tag-id") response = { object: { type: "commit", sha: meta.sourceSha } };
        else if (endpoint.startsWith(repo + "/releases")) response = endpoint.includes("?") ? [{ id: 1, tag_name: meta.tag, draft: false, assets: wrongDigest ? assets.map(a => ({ ...a, digest: "sha256:wrong" })) : assets }] : { id: 1, assets };
        else if (endpoint === repo + "/git/ref/heads/main") response = { object: { sha: "main-id" } };
        else if (endpoint.includes("/git/matching-refs/")) response = [];
        else if (endpoint === repo + "/git/refs") {
          assert.equal(args[3], "POST"); response = {};
          assert.deepEqual(JSON.parse(options.input), { ref: "refs/heads/release-feed/" + meta.tag, sha: "main-id" });
        } else if (endpoint.includes("/compare/")) response = { files: unrelated ? [{ filename: "unrelated.js" }] : calls.some(a => a[1] === repo + "/contents/updater/latest.json") ? [{ filename: "updater/latest.json" }] : [] };
        else if (endpoint === repo + "/contents/updater/latest.json") {
          assert.equal(args[3], "PUT");
          const body = JSON.parse(options.input);
          assert.equal(body.branch, "release-feed/" + meta.tag);
          assert.deepEqual(JSON.parse(Buffer.from(body.content, "base64")), feed);
          response = {};
        } else assert.fail("Unexpected GitHub operation: " + endpoint);
        return JSON.stringify(response);
      } };
      publish(meta, dir, stub);
      return calls;
    };
    const calls = simulate();
    assert.ok(calls.some(a => a[0] === "pr" && a[1] === "create"));
    assert.ok(!simulate({ exact: true }).some(a => a[0] === "pr"));
    assert.throws(() => simulate({ wrongDigest: true }), /refusing replacement/);
    assert.throws(() => simulate({ unrelated: true }), /unrelated changes/);
  } finally {
    if (oldRepository === undefined) delete process.env.GITHUB_REPOSITORY; else process.env.GITHUB_REPOSITORY = oldRepository;
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test("a stale feed PR cannot roll back a newer main feed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feed-merge-"));
  const git = (...args) => L.run("git", ["-C", dir, ...args]);
  try {
    git("init", "--initial-branch=main"); git("config", "user.name", "Fixture");
    git("config", "user.email", "fixture@users.noreply.github.com");
    fs.mkdirSync(path.join(dir, "updater"));
    const file = path.join(dir, "updater/latest.json");
    fs.writeFileSync(file, JSON.stringify({ version: "1.2.0", platforms: {} }));
    git("add", "."); git("commit", "-m", "newer release already merged");
    git("update-ref", "refs/remotes/origin/main", git("rev-parse", "HEAD"));
    fs.writeFileSync(file, JSON.stringify({ version: "1.1.0", platforms: {} }));
    assert.throws(() => G.checkFeedAgainstMain(dir), /rollback/);
    fs.writeFileSync(file, JSON.stringify({ version: "1.2.0", platforms: { changed: true } }));
    assert.throws(() => G.checkFeedAgainstMain(dir), /replacement/);
    fs.writeFileSync(file, JSON.stringify({ version: "1.3.0", platforms: {} }));
    assert.equal(G.checkFeedAgainstMain(dir), true);
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
