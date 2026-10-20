import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const script = fileURLToPath(new URL('../scripts/plan-sdk-generation.ts', import.meta.url));

for (const option of ['--root', '--api-contracts-root']) {
  for (const value of [undefined, '--check', '', '   ']) {
    test(`rejects ${option} with missing path ${JSON.stringify(value)}`, () => {
      const args = value === undefined ? [option] : [option, value];
      const result = Bun.spawnSync([process.execPath, script, ...args], { cwd: root, timeout: 10_000 });
      expect(result.exitCode).toBe(2);
      expect(result.stderr.toString()).toContain(option);
      expect(result.stderr.toString()).toContain('SDK_GENERATION_PLAN_INVALID_ARGUMENT');
      expect(result.stdout.toString()).toBe('');
    });
  }
}

test('accepts explicit repository paths and the package-script separator', () => {
  const apiRoot = fileURLToPath(new URL('../../zdp-api-contracts', import.meta.url));
  const result = Bun.spawnSync([
    process.execPath, script, '--root', root, '--api-contracts-root', apiRoot, '--', '--check'
  ], { cwd: root, timeout: 10_000 });
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain('SDK generation plan check passed.');
  expect(result.stderr.toString()).toBe('');
});
