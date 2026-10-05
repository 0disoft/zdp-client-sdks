import { expect, test } from 'bun:test';
import { parsePackResult } from '../scripts/npm-pack-result';

const packed = { filename: 'sdk-0.19.0.tgz', integrity: `sha512-${Buffer.alloc(64).toString('base64')}` };

test('release packaging accepts npm 11 arrays and npm 12 package maps', () => {
  expect(parsePackResult([packed])).toEqual(packed);
  expect(parsePackResult({ 'zdp-client-sdks': packed })).toEqual(packed);
});

test('release packaging rejects ambiguous, malformed and escaping tarball output', () => {
  for (const value of [null, 'invalid', [], {}, [packed, packed], { first: packed, second: packed },
    [null], [packed.filename], [{ ...packed, integrity: 'invalid' }],
    ...['', '.', '..', '../sdk.tgz', '..\\sdk.tgz', '/sdk.tgz'].map((filename) => [{ ...packed, filename }])]) {
    expect(() => parsePackResult(value)).toThrow();
  }
});
