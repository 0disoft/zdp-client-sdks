import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

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
