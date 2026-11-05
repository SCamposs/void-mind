"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const L = require("./release-lib.cjs");
const [mode, ...args] = process.argv.slice(2);
function output(name, value) { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, name + "=" + value + "\n"); }
try {
  if (mode === "prepare") {
    const tag = L.validateTag(args[0]);
    const event = process.env.GITHUB_EVENT_NAME;
    L.ensure((event === "workflow_dispatch" && process.env.GITHUB_REF === "refs/heads/main") ||
      (event === "push" && process.env.GITHUB_REF === "refs/tags/" + tag), "Releases must start from main or a version-tag push");
    L.ensure(process.env.GITHUB_REPOSITORY === L.policy.repository, "Wrong repository");
    const ref = "refs/tags/" + tag;
    L.ensure(L.run("git", ["cat-file", "-t", ref]) === "tag", "Release tags must be annotated");
    const sourceSha = L.run("git", ["rev-parse", "--verify", ref + "^{commit}"]);
    L.run("git", ["merge-base", "--is-ancestor", sourceSha, "origin/main"], { safeError: "Tag is not part of trusted main" });
    const read = file => L.run("git", ["show", sourceSha + ":" + file]);
    const config = JSON.parse(read(L.policy.desktop + "/src-tauri/tauri.conf.json"));
    const pkg = JSON.parse(read(L.policy.desktop + "/package.json"));
    const notes = read("docs/releases/" + tag + ".md");
    const metadata = L.makeMetadata(tag, config, pkg, sourceSha, notes);
    fs.mkdirSync("metadata", { recursive: true });
    fs.writeFileSync("metadata/release-metadata.json", JSON.stringify(metadata, null, 2) + "\n");
    output("source_sha", sourceSha); output("tag", tag);
  } else if (mode === "sign") {
    const metadata = JSON.parse(fs.readFileSync(args[0], "utf8"));
    L.checkMetadata(metadata);
    L.ensure(process.env.TAURI_SIGNING_PRIVATE_KEY, "Protected signing key is unavailable");
    const names = L.packageNames();
    L.assertFiles(args[1], names);
    fs.mkdirSync(args[2], { recursive: true });
    L.ensure(fs.readdirSync(args[2]).length === 0, "Signing output must be empty");
    const cli = path.resolve(__dirname, "../signing/node_modules/@tauri-apps/cli/tauri.js");
    const signatures = {};
    for (const name of names) {
      const file = path.resolve(args[2], name);
      fs.copyFileSync(path.join(args[1], name), file);
      // Fixed tool, shell-free arguments. Package bytes are never executed.
      const result = spawnSync(process.execPath, [cli, "signer", "sign", "--password=", file], {
        env: process.env, stdio: ["ignore", "pipe", "pipe"], timeout: 120000
      });
      L.ensure(!result.error && result.status === 0, "Signing failed for " + name);
      const bytes = fs.readFileSync(file);
      signatures[name] = fs.readFileSync(file + ".sig", "utf8").trim();
      L.verifySignature(bytes, signatures[name], L.policy.pubkey);
      fs.writeFileSync(file + ".sha256", L.sha256(bytes) + "  " + name + "\n");
    }
    delete process.env.TAURI_SIGNING_PRIVATE_KEY;
    fs.writeFileSync(path.join(args[2], "latest.json"), JSON.stringify(L.manifest(metadata, signatures), null, 2) + "\n");
    L.verifySigned(args[2], metadata);
    console.log("Verified signatures, checksums and package routes for all three artifacts.");
  } else if (mode === "verify") {
    L.verifySigned(args[1], JSON.parse(fs.readFileSync(args[0], "utf8")));
    console.log("Signed release verification passed.");
  } else { throw new Error("Unknown release command"); }
} catch (error) {
  // Do not echo child-process stdout/stderr or secret-bearing command context.
  console.error(error.message);
  process.exitCode = 1;
}
