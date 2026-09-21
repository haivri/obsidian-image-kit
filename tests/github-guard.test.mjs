import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const previous = '0'.repeat(40); // Also works in shallow CI checkouts.
const check = (remote, url, approval = '', sha = head) => spawnSync(process.execPath, ['.githooks/pre-push', remote, url], {
  encoding: 'utf8', env: { ...process.env, IMAGE_KIT_GITHUB_APPROVED_COMMIT: approval },
  input: `refs/heads/main ${sha} refs/heads/main ${previous}\n`
});
test('Forgejo backup remains available without GitHub approval', () => {
  assert.equal(check('origin', 'https://git.robertfleming.cloud/repo.git').status, 0);
});
test('GitHub remote, direct URL, and renamed remote are blocked by default', () => {
  for (const [name, url] of [['github', 'git@alias:repo.git'], ['https://github.com/owner/repo.git', 'https://github.com/owner/repo.git'], ['origin', 'git@github.com:owner/repo.git']]) {
    assert.equal(check(name, url).status, 1);
  }
});
test('only the exact approved current commit passes; stale approval and other refs fail', () => {
  assert.equal(check('github', 'https://github.com/owner/repo.git', head).status, 0);
  assert.equal(check('github', 'https://github.com/owner/repo.git', previous).status, 1);
  assert.equal(check('github', 'https://github.com/owner/repo.git', head, previous).status, 1);
});
