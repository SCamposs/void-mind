"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const defaults = require("./release-lib.cjs");
function publish(metadata, directory, L = defaults) {
let stage;
function api(endpoint, method = "GET", body) {
  return JSON.parse(L.run("gh", ["api", endpoint, "--method", method, ...(body ? ["--input", "-"] : [])], body ? { input: JSON.stringify(body) } : {}));
}
try {
  L.checkMetadata(metadata); L.verifySigned(directory, metadata);
  L.ensure(process.env.GITHUB_REPOSITORY === L.policy.repository, "Wrong publication repository");
  const repo = "repos/" + L.policy.repository;
  const feed = JSON.parse(fs.readFileSync(path.join(directory, "latest.json"), "utf8"));
  const current = api(repo + "/contents/updater/latest.json?ref=main");
  const advance = L.assertFeedAdvance(JSON.parse(Buffer.from(current.content, "base64")), feed);
  const tagRef = api(repo + "/git/ref/tags/" + metadata.tag);
  L.ensure(tagRef.object.type === "tag", "Expected annotated remote tag");
  const tag = api(repo + "/git/tags/" + tagRef.object.sha);
  L.ensure(tag.object.type === "commit" && tag.object.sha === metadata.sourceSha, "Remote release tag changed");
  stage = fs.mkdtempSync(path.join(os.tmpdir(), "release-publication-"));
  const bodyFile = path.join(stage, "notes.md");
  fs.writeFileSync(bodyFile, metadata.notes);
  const flags = ["--repo", L.policy.repository];
  const releases = api(repo + "/releases?per_page=100");
  let release = releases.find(r => r.tag_name === metadata.tag);
  if (!release) {
    L.run("gh", ["release", "create", metadata.tag, ...flags, "--verify-tag", "--draft", "--title",
      L.policy.name + " " + metadata.tag, "--notes-file", bodyFile,
      ...(require("../signing/node_modules/semver").prerelease(metadata.tag.slice(1)) ? ["--prerelease"] : [])]);
    release = api(repo + "/releases?per_page=100").find(r => r.tag_name === metadata.tag);
  }
  L.ensure(release, "Release creation failed");
  const names = fs.readdirSync(directory);
  const missing = [];
  for (const name of names) {
    const asset = release.assets.find(a => a.name === name);
    if (asset) L.ensure(asset.digest === "sha256:" + L.sha256(fs.readFileSync(path.join(directory, name))), "Existing release asset differs; refusing replacement");
    else missing.push(path.join(directory, name));
  }
  L.ensure(release.draft || missing.length === 0, "Refusing to add files to a published release");
  if (missing.length) L.run("gh", ["release", "upload", metadata.tag, ...flags, ...missing]);
  release = api(repo + "/releases/" + release.id);
  L.ensure(release.assets.length === names.length, "Unexpected release assets");
  for (const asset of release.assets) L.ensure(names.includes(asset.name) &&
    asset.digest === "sha256:" + L.sha256(fs.readFileSync(path.join(directory, asset.name))), "Published digest mismatch");
  if (release.draft) L.run("gh", ["release", "edit", metadata.tag, ...flags, "--draft=false"]);
  console.log("Release packages published and digests verified.");
  if (!advance) { console.log("Updater already has this exact signed version."); return; }

  // Keep the installed main endpoint. No direct main push and no bypass identity.
  const newest = api(repo + "/contents/updater/latest.json?ref=main");
  if (!L.assertFeedAdvance(JSON.parse(Buffer.from(newest.content, "base64")), feed)) return;
  const main = api(repo + "/git/ref/heads/main");
  const branch = "release-feed/" + metadata.tag;
  const refs = api(repo + "/git/matching-refs/heads/" + branch);
  if (!refs.some(r => r.ref === "refs/heads/" + branch)) api(repo + "/git/refs", "POST", { ref: "refs/heads/" + branch, sha: main.object.sha });
  const before = api(repo + "/compare/main..." + encodeURIComponent(branch));
  L.ensure(before.files.every(f => f.filename === "updater/latest.json"), "Feed branch contains unrelated changes");
  const previous = api(repo + "/contents/updater/latest.json?ref=" + encodeURIComponent(branch));
  api(repo + "/contents/updater/latest.json", "PUT", { branch, sha: previous.sha,
    message: "chore(release): update feed to " + metadata.tag,
    content: fs.readFileSync(path.join(directory, "latest.json")).toString("base64") });
  const compare = api(repo + "/compare/main..." + encodeURIComponent(branch));
  L.ensure(compare.files.length === 1 && compare.files[0].filename === "updater/latest.json", "Unexpected feed PR changes");
  const pulls = JSON.parse(L.run("gh", ["pr", "list", ...flags, "--base", "main", "--head", branch, "--state", "open", "--json", "number,url"]));
  const prBody = path.join(stage, "feed-pr.md");
  fs.writeFileSync(prBody, "Updates only the installed updater feed to " + metadata.tag +
    ". Packages are published, signatures and asset digests verified. Source commit: " + metadata.sourceSha +
    ".\n\nReview the four package URLs/signatures, approve the workflow runs if GitHub requests it, and merge after Security checks passes. Merging completes update delivery; publication alone does not update installed apps.\n");
  if (!pulls.length) console.log(L.run("gh", ["pr", "create", ...flags, "--base", "main", "--head", branch,
    "--title", "chore(release): deliver " + metadata.tag + " updates", "--body-file", prBody]));
  else console.log("Feed review PR: " + pulls[0].url);
} finally {
  if (stage) {
    L.ensure(path.resolve(stage).startsWith(path.resolve(os.tmpdir()) + path.sep), "Unsafe publication cleanup path");
    fs.rmSync(stage, { recursive: true, force: true });
  }
}
}
module.exports = { publish };
if (require.main === module) {
  try { publish(JSON.parse(fs.readFileSync(process.argv[2], "utf8")), path.resolve(process.argv[3])); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
