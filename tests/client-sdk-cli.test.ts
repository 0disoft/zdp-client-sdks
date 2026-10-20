import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadClientSdkContracts } from '../src/client-sdk-contracts/parser';

const root = fileURLToPath(new URL('..', import.meta.url));
const script = fileURLToPath(new URL('../scripts/check-client-sdk-contracts.ts', import.meta.url));

for (const value of [undefined, '--check', '', '   ']) {
  test(`rejects a missing contract-check root ${JSON.stringify(value)}`, () => {
    const args = value === undefined ? ['--root'] : ['--root', value];
    const result = Bun.spawnSync([process.execPath, script, ...args], { cwd: root, timeout: 10_000 });
    expect(result.exitCode).toBe(2);
    expect(result.stderr.toString()).toContain('CLIENT_SDK_INVALID_ARGUMENT');
    expect(result.stderr.toString()).toContain('--root');
    expect(result.stdout.toString()).toBe('');
  });
}

for (const args of [[], ['--root', root]]) {
  test(`checks the intended root with ${args.length ? 'explicit' : 'default'} options`, () => {
    const result = Bun.spawnSync([process.execPath, script, ...args], { cwd: root, timeout: 10_000 });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('Client SDK contract check passed.');
    expect(result.stderr.toString()).toBe('');
  });
}

test('reports the actual contract file when YAML parsing fails', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'client-sdk-yaml-'));
  try {
    mkdirSync(join(fixture, 'contracts'));
    for (const file of ['sdk-surface.yaml', 'sdk-generation-source.yaml', 'libs-export-source.yaml', 'auth-helper.yaml', 'upload-client.yaml']) {
      copyFileSync(join(root, 'contracts', file), join(fixture, 'contracts', file));
    }
    const invalidFile = join(fixture, 'contracts', 'auth-helper.yaml');
    writeFileSync(invalidFile, 'auth_helper: [\n');
    const result = Bun.spawnSync([process.execPath, script, '--root', fixture], {
      cwd: root, timeout: 10_000
    });
    expect(result.exitCode).toBe(1);
    expect(result.stdout.toString()).toBe('');
    expect(result.stderr.toString()).toContain(invalidFile);
    let failure: unknown;
    try { await loadClientSdkContracts(fixture); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(invalidFile);
    expect((failure as Error).cause).toBeInstanceOf(Error);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
