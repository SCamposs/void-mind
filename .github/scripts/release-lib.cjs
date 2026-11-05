"use strict";
const fs = require("node:fs");
const path = require("node:path");
const nodeCrypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const toolRequire = createRequire(path.resolve(__dirname, "../signing/package.json"));
const semver = toolRequire("semver");
const policy = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../signing/policy.json"), "utf8"));
function ensure(value, message) { if (!value) throw new Error(message); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false, ...options });
  ensure(!result.error && result.status === 0, options.safeError || "Command failed: " + command);
  return result.stdout.trim();
}
function validateTag(tag) {
  ensure(typeof tag === "string" && /^v[0-9A-Za-z.+-]+$/.test(tag), "Expected a literal version tag");
  ensure(semver.valid(tag.slice(1)) === tag.slice(1), "Invalid version tag");
  return tag;
}
function packageNames(p = policy) {
  return [p.prefix + "-Windows-x64-setup.exe", p.prefix + "-Linux-x64.deb", p.prefix + "-Linux-x64.AppImage"];
}
function makeMetadata(tag, config, pkg, sourceSha, notes, p = policy) {
  validateTag(tag);
  ensure(/^[a-f0-9]{40}$/.test(sourceSha), "Invalid source commit");
  const version = tag.slice(1);
  const mapped = p.versionKind === "numeric-alpha" ? version.replace(/^(\d+\.\d+\.\d+)-alpha\.(\d+)$/, "$1-$2") : version;
  ensure(pkg.version === version && config.version === mapped && semver.valid(mapped), "Package/tag/native version mismatch");
  ensure(config.plugins?.updater?.pubkey === p.pubkey, "Updater public key must remain unchanged");
  ensure(config.plugins.updater.endpoints?.includes("https://raw.githubusercontent.com/" + p.repository + "/main/updater/latest.json"), "Installed updater endpoint must remain unchanged");
  return { repository: p.repository, tag, sourceSha, version: mapped, pubkey: p.pubkey, notes, prefix: p.prefix };
}
function checkMetadata(m, p = policy) {
  validateTag(m.tag);
  ensure(m.repository === p.repository && m.prefix === p.prefix && m.pubkey === p.pubkey, "Release policy identity mismatch");
  ensure(/^[a-f0-9]{40}$/.test(m.sourceSha) && semver.valid(m.version) === m.version, "Invalid release metadata");
  const expected = p.versionKind === "numeric-alpha" ? m.tag.slice(1).replace(/^(\d+\.\d+\.\d+)-alpha\.(\d+)$/, "$1-$2") : m.tag.slice(1);
  ensure(m.version === expected, "Native release version mismatch");
}
function assertFiles(directory, expected) {
  const root = fs.lstatSync(directory);
  ensure(root.isDirectory() && !root.isSymbolicLink(), "Invalid artifact directory");
  const actual = fs.readdirSync(directory).sort();
  ensure(JSON.stringify(actual) === JSON.stringify([...expected].sort()), "Unexpected or missing artifact files");
  for (const name of actual) {
    const stat = fs.lstatSync(path.join(directory, name));
    ensure(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 1024 ** 3, "Invalid artifact file: " + name);
  }
}
function sha256(bytes) { return nodeCrypto.createHash("sha256").update(bytes).digest("hex"); }
function verifySignature(bytes, encoded, pubkey) {
  const publicLines = Buffer.from(pubkey.trim(), "base64").toString("utf8").trim().split(/\r?\n/);
  const pub = Buffer.from(publicLines[1] || "", "base64");
  const lines = Buffer.from(encoded.trim(), "base64").toString("utf8").trim().split(/\r?\n/);
  const sig = Buffer.from(lines[1] || "", "base64");
  ensure(pub.length === 42 && sig.length === 74 && lines.length === 4, "Invalid minisign encoding");
  ensure(pub.subarray(2, 10).equals(sig.subarray(2, 10)), "Signing key identity mismatch");
  const algorithm = sig.subarray(0, 2).toString("ascii");
  ensure(algorithm === "ED" || algorithm === "Ed", "Unsupported signature algorithm");
  const key = nodeCrypto.createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), pub.subarray(10)]), format: "der", type: "spki" });
  const payload = algorithm === "ED" ? nodeCrypto.createHash("blake2b512").update(bytes).digest() : bytes;
  ensure(nodeCrypto.verify(null, payload, key, sig.subarray(10)), "Invalid package signature");
  ensure(lines[2].startsWith("trusted comment: "), "Invalid trusted comment");
  ensure(nodeCrypto.verify(null, Buffer.concat([sig.subarray(10), Buffer.from(lines[2].slice(17))]), key, Buffer.from(lines[3], "base64")), "Invalid comment signature");
}
function manifest(metadata, signatures, p = policy) {
  checkMetadata(metadata, p);
  const names = packageNames(p);
  const base = "https://github.com/" + p.repository + "/releases/download/" + metadata.tag + "/";
  const route = name => ({ signature: signatures[name], url: base + name });
  return { version: metadata.version, notes: "See the GitHub release notes for " + metadata.tag + ".", pub_date: new Date().toISOString(), platforms: {
    "windows-x86_64": route(names[0]), "linux-x86_64": route(names[2]),
    "linux-x86_64-appimage": route(names[2]), "linux-x86_64-deb": route(names[1])
  } };
}
function verifyManifest(feed, metadata, signatures, p = policy) {
  checkMetadata(metadata, p);
  const expected = manifest(metadata, signatures, p);
  ensure(feed.version === expected.version && !Number.isNaN(Date.parse(feed.pub_date)), "Invalid feed version/date");
  ensure(JSON.stringify(feed.platforms) === JSON.stringify(expected.platforms), "Invalid package routing/signatures");
}
function verifySigned(directory, metadata, p = policy) {
  checkMetadata(metadata, p);
  const names = packageNames(p);
  assertFiles(directory, [...names.flatMap(n => [n, n + ".sig", n + ".sha256"]), "latest.json"]);
  const signatures = {};
  for (const name of names) {
    const bytes = fs.readFileSync(path.join(directory, name));
    signatures[name] = fs.readFileSync(path.join(directory, name + ".sig"), "utf8").trim();
    verifySignature(bytes, signatures[name], p.pubkey);
    ensure(fs.readFileSync(path.join(directory, name + ".sha256"), "utf8").trim() === sha256(bytes) + "  " + name, "Checksum mismatch");
  }
  verifyManifest(JSON.parse(fs.readFileSync(path.join(directory, "latest.json"), "utf8")), metadata, signatures, p);
}
function assertFeedAdvance(current, next) {
  ensure(semver.valid(current.version) && semver.valid(next.version), "Invalid feed comparison");
  ensure(semver.gte(next.version, current.version), "Refusing updater rollback");
  if (semver.eq(next.version, current.version)) {
    ensure(JSON.stringify(current.platforms) === JSON.stringify(next.platforms), "Refusing replacement of an existing version");
    return false;
  }
  return true;
}
module.exports = { policy, run, ensure, validateTag, packageNames, makeMetadata, checkMetadata, assertFiles, sha256, verifySignature, manifest, verifyManifest, verifySigned, assertFeedAdvance };
