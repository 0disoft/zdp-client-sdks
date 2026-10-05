import assert from 'node:assert/strict';
import { basename } from 'node:path';

/** npm <=11 emits an array; npm 12 emits an object keyed by package name. */
export function parsePackResult(value: unknown): { filename: string; integrity: string } {
  assert.ok(Array.isArray(value) || isRecord(value), 'npm pack output must be an array or package map.');
  const entries: unknown[] = Array.isArray(value) ? value : Object.values(value);
  assert.equal(entries.length, 1, 'npm pack must create exactly one tarball.');
  const result = entries[0];
  assert.ok(isRecord(result), 'npm pack result must be an object.');
  const { filename, integrity } = result;
  assert.ok(typeof filename === 'string' && filename.length > 0, 'npm pack filename must be a nonempty string.');
  assert.ok(typeof integrity === 'string' && /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity), 'npm pack integrity must be SHA-512.');
  assert.ok(filename !== '.' && filename !== '..' && !/[\\/]/.test(filename), 'npm pack filename must be a basename.');
  assert.equal(basename(filename), filename);
  return { filename, integrity };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
