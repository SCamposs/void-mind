"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const assert = require("node:assert/strict");
const tools = createRequire(path.resolve(__dirname, "../signing/package.json"));
const YAML = tools("yaml");
function parse(source) {
  const doc = YAML.parseDocument(source, { strict: true, uniqueKeys: true, stringKeys: true });
  assert.equal(doc.errors.length, 0, "Invalid/duplicate workflow keys");
  return doc.toJS({ maxAliasCount: 20 });
}
function checkWorkflow(name, source) {
  const workflow = parse(source);
  assert.deepEqual(workflow.permissions, { contents: "read" }, "Default workflow token must be read-only");
  assert.ok(!workflow.on?.pull_request_target && !workflow.on?.workflow_run, "Untrusted privileged triggers are disallowed");
  let signingReferences = 0;
  for (const [id, job] of Object.entries(workflow.jobs)) {
    assert.ok(!job.secrets, "No inherited reusable-workflow secrets");
    assert.ok(!JSON.stringify(job.env || {}).includes("secrets."), "No secrets at job scope");
    if (job.permissions && Object.values(job.permissions).includes("write")) {
      assert.equal(name, "release.yml"); assert.equal(id, "publish");
      assert.deepEqual(job.permissions, { contents: "write", "pull-requests": "write" });
    }
    for (const step of job.steps || []) {
      if (step.uses) {
        assert.match(step.uses, /^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/, "Pin actions to immutable commits");
        if (step.uses.startsWith("actions/checkout@")) assert.equal(step.with?.["persist-credentials"], false, "Checkout credentials must not persist");
        if (step.uses.startsWith("actions/upload-artifact@")) assert.equal(step.with?.["retention-days"], 7, "Bound evidence retention");
      }
      const text = JSON.stringify(step);
      if (text.includes("secrets.")) {
        signingReferences++;
        assert.equal(name, "release.yml"); assert.equal(id, "sign");
        assert.deepEqual(step.env, { TAURI_SIGNING_PRIVATE_KEY: "$" + "{{ secrets.TAURI_SIGNING_PRIVATE_KEY }}" });
        assert.equal(step.run, "node .github/scripts/release.cjs sign metadata/release-metadata.json unsigned signed");
      }
      if (/tauri -- (build|bundle)/.test(step.run || "") && !step.run.includes("--no-bundle")) {
        assert.ok(step.run.includes('"createUpdaterArtifacts":false'), "Builds/validation must not sign");
      }
    }
  }
  if (name === "release.yml") {
    const sign = workflow.jobs.sign;
    assert.equal(sign.environment, "release-signing");
    assert.equal(sign["runs-on"], "ubuntu-22.04");
    assert.deepEqual(sign.needs, ["prepare", "windows", "linux"]);
    assert.equal(signingReferences, 1);
    assert.equal(workflow.on.workflow_dispatch.inputs.verify_only.default, true);
    assert.equal(workflow.concurrency["cancel-in-progress"], false);
    const runs = sign.steps.filter(s => s.run).map(s => s.run);
    assert.deepEqual(runs, [
      "npm ci --prefix .github/signing --ignore-scripts --no-audit --no-fund",
      "node .github/scripts/release.cjs sign metadata/release-metadata.json unsigned signed",
      "node .github/scripts/release.cjs verify metadata/release-metadata.json signed"
    ], "No app/build/artifact execution on signer");
    for (const step of sign.steps) {
      assert.ok(!step.uses?.includes("cache"), "Fresh signer must not restore build caches");
      if (step.uses?.startsWith("actions/setup-node@")) assert.ok(!step.with.cache);
      if (step.uses?.startsWith("actions/checkout@")) {
        assert.equal(step.with.ref, "$" + "{{ github.workflow_sha }}");
        assert.equal(step.with["sparse-checkout"].trim(), ".github/scripts\n.github/signing");
      }
    }
    assert.ok(!JSON.stringify(workflow.jobs.publish).includes("secrets."), "Publisher must not receive signing credentials");
    assert.match(workflow.jobs.publish.if, /!inputs.verify_only/);
  } else assert.equal(signingReferences, 0);
  return true;
}
function checkRepository(root = process.cwd()) {
  const directory = path.join(root, ".github/workflows");
  for (const name of fs.readdirSync(directory).filter(n => /\.ya?ml$/.test(n))) checkWorkflow(name, fs.readFileSync(path.join(directory, name), "utf8"));
  const cfg = JSON.parse(fs.readFileSync(path.join(root, require("./release-lib.cjs").policy.desktop, "src-tauri/tauri.conf.json"), "utf8"));
  assert.equal(cfg.bundle.createUpdaterArtifacts, true, "Keep normal release signature enforcement");
  assert.equal(cfg.plugins.updater.pubkey, require("./release-lib.cjs").policy.pubkey);
}
if (require.main === module) { checkRepository(); console.log("Workflow signing boundary and updater identity checks passed."); }
module.exports = { parse, checkWorkflow, checkRepository };
