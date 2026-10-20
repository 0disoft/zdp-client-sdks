import { expect, test } from 'bun:test';
import { createZdpSignedUploadClient, ZdpUploadTransferError } from '../src/upload';

const source = new Blob(['x'], { type: 'text/plain' });
const checksum = { algorithm: 'sha256' as const, value: '0'.repeat(64) };

function fixture(retryAfter: string, maxDelayMs: number) {
  let attempts = 0;
  let completions = 0;
  let cancellations = 0;
  const client = createZdpSignedUploadClient({
    limits: { maxFileSizeBytes: 100, allowedContentTypes: ['text/plain'] },
    retryPolicy: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs },
    transfer: async () => {
      attempts++;
      return attempts === 1
        ? new Response(new ReadableStream({ cancel() { cancellations++; } }), {
            status: 429, headers: { 'retry-after': retryAfter }
          })
        : new Response(null, { status: 204 });
    },
    authorize: async () => ({
      uploadRef: 'fixture-upload', expiresAt: null, replaySafe: true,
      maxFileSizeBytes: 100, allowedContentTypes: ['text/plain'],
      createRequest: () => new Request('https://upload.invalid/fixture', { method: 'PUT' }),
      complete: async () => {
        completions++;
        return { uploadRef: 'fixture-upload', objectRef: 'fixture-object', state: 'ready' as const };
      }
    })
  });
  return {
    upload: () => client.upload({ source, fileName: 'fixture.txt', checksum }),
    counts: () => ({ attempts, completions, cancellations })
  };
}

for (const retryAfter of ['60', 'Wed, 01 Jan 2098 00:00:00 GMT', '9'.repeat(400)]) {
  test(`does not shorten an over-budget Retry-After (${retryAfter.slice(0, 30)})`, async () => {
    const { upload, counts } = fixture(retryAfter, 0);
    const result = await upload().then(value => value, error => error);
    expect(result).toBeInstanceOf(ZdpUploadTransferError);
    expect(result).toMatchObject({ status: 429, attempts: 1 });
    expect(counts()).toEqual({ attempts: 1, completions: 0, cancellations: 1 });
  });
}

test('Retry-After zero still permits an immediate replay-safe retry', async () => {
  const { upload, counts } = fixture('0', 0);
  await expect(upload()).resolves.toMatchObject({ state: 'ready' });
  expect(counts()).toEqual({ attempts: 2, completions: 1, cancellations: 1 });
});

test('waits for an allowed Retry-After before retrying', async () => {
  const { upload, counts } = fixture('1', 1_000);
  const started = performance.now();
  await expect(upload()).resolves.toMatchObject({ state: 'ready' });
  expect(performance.now() - started).toBeGreaterThanOrEqual(990);
  expect(counts()).toEqual({ attempts: 2, completions: 1, cancellations: 1 });
});
