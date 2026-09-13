#!/usr/bin/env node
// Installs the built runtime artifacts into the primary Obsidian vault.
// Runtime-only by contract (see AGENTS.md): main.js, manifest.json, and
// styles.css are copied, the vault's own data.json is never touched, and
// anything else in the installed folder (e.g. a legacy full-tree install)
// is removed. A .release.json records artifact hashes and the source
// commit so an installed copy can always be traced back to this repo.
//
// Usage: node publish-vault.mjs   (run the production build first, or use
// the npm scripts: `npm run publish:vault` builds then installs;
// `npm run ship` also pushes to origin. GitHub stays a manual release push.)
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const VAULT = process.env.OBSIDIAN_VAULT ?? '/Users/robertfleming/vaults/obsidian-vault';
const ARTIFACTS = ['main.js', 'manifest.json', 'styles.css'];

const repoRoot = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));

for (const name of ARTIFACTS) {
  if (!fs.existsSync(path.join(repoRoot, name))) {
    console.error(`Missing ${name} — run the production build first.`);
    process.exit(1);
  }
}

if (!fs.existsSync(path.join(VAULT, '.obsidian'))) {
  console.error(`No Obsidian vault at ${VAULT} (set OBSIDIAN_VAULT to override).`);
  process.exit(1);
}

const dest = path.join(VAULT, '.obsidian', 'plugins', manifest.id);
fs.mkdirSync(dest, { recursive: true });

for (const entry of fs.readdirSync(dest)) {
  if (entry === 'data.json' || entry === '.release.json' || ARTIFACTS.includes(entry)) continue;
  fs.rmSync(path.join(dest, entry), { recursive: true, force: true });
}

const artifacts = {};
for (const name of ARTIFACTS) {
  const content = fs.readFileSync(path.join(repoRoot, name));
  fs.writeFileSync(path.join(dest, name), content);
  artifacts[name] = createHash('sha256').update(content).digest('hex');
}

const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const remotes = {};
for (const remote of git('remote').split('\n').filter(Boolean)) {
  remotes[remote] = git('remote', 'get-url', remote);
}

let sourceCommit = null;
try { sourceCommit = git('rev-parse', '--verify', 'HEAD'); } catch { /* Initial development build. */ }

const release = {
  artifacts,
  plugin_id: manifest.id,
  schema_version: 1,
  source_commit: sourceCommit,
  source_dirty: Boolean(git('status', '--porcelain')),
  source_remotes: remotes,
  version: manifest.version
};
fs.writeFileSync(path.join(dest, '.release.json'), `${JSON.stringify(release, null, 2)}\n`);
console.log(`Installed ${manifest.id} ${manifest.version} (${sourceCommit?.slice(0, 7) ?? 'uncommitted development build'}) → ${dest}`);
