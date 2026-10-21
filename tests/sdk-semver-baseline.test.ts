import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findBaselineRef } from '../scripts/sdk-semver/git-baseline';

test('uses the current release baseline for staged and unstaged surface changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'sdk-semver-baseline-'));
  const paths = {
    packagePath: 'package.json', apiLockPath: 'api-lock.json',
    operationsPath: 'operations.ts', runtimeTypesPath: 'runtime.ts'
  };
  const git = (...args: string[]) => execFileSync('git', args, {
    cwd: root, stdio: 'pipe',
    env: { ...process.env, GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
  });
  const baseline = () => findBaselineRef({
    repositoryRoot: root, currentVersion: '1.1.0', explicitRef: null, paths
  });
  try {
    git('init');
    git('config', 'user.name', 'SDK fixture');
    git('config', 'user.email', 'fixture@example.test');
    git('config', 'commit.gpgsign', 'false');
    // Keep fixture commits independent of machine-wide hooks.
    git('config', 'core.hooksPath', join(root, 'no-hooks'));
    writeFileSync(join(root, paths.packagePath), JSON.stringify({ version: '1.0.0' }));
    for (const path of [paths.apiLockPath, paths.operationsPath, paths.runtimeTypesPath]) {
      writeFileSync(join(root, path), 'original\n');
    }
    git('add', '--', ...Object.values(paths));
    git('commit', '-m', 'baseline');
    git('tag', 'v1.0.0');
    writeFileSync(join(root, paths.packagePath), JSON.stringify({ version: '1.1.0' }));
    git('add', '--', paths.packagePath);
    git('commit', '-m', 'current release');
    git('tag', 'v1.1.0');
    expect(baseline()).toBe('v1.0.0');

    const path = paths.operationsPath;
    writeFileSync(join(root, path), 'changed\n');
    expect(baseline()).toBe('v1.1.0');
    git('add', '--', path);
    expect(baseline()).toBe('v1.1.0');
    writeFileSync(join(root, path), 'original\n');
    git('add', '--', path);
    expect(baseline()).toBe('v1.0.0');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
