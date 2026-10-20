import { expect, test } from 'bun:test';
import { createZdpSignedUploadClient, ZdpUploadConfigurationError } from '../src/upload';
import type { ZdpSignedUploadClientOptions } from '../src/upload';

const MAX_TIMER_DELAY_MS = 2_147_483_647;
const options: ZdpSignedUploadClientOptions = {
  limits: { maxFileSizeBytes: 100, allowedContentTypes: ['text/plain'] },
  authorize: async () => { throw new Error('authorization must not run'); }
};

for (const field of ['defaultTimeoutMs', 'baseDelayMs', 'maxDelayMs'] as const) {
  test(`constructor rejects ${field} that would overflow the runtime timer`, () => {
    const overflow = MAX_TIMER_DELAY_MS + 1;
    const override = field === 'defaultTimeoutMs'
      ? { defaultTimeoutMs: overflow }
      : { retryPolicy: { baseDelayMs: field === 'baseDelayMs' ? overflow : 0, maxDelayMs: overflow } };
    expect(() => createZdpSignedUploadClient({ ...options, ...override }))
      .toThrow(ZdpUploadConfigurationError);
  });
}

test('call timeout overflow fails before authorization or progress callbacks', async () => {
  let progress = 0;
  const client = createZdpSignedUploadClient(options);
  await expect(client.upload({
    source: new Blob(['x'], { type: 'text/plain' }), fileName: 'fixture.txt'
  }, { timeoutMs: MAX_TIMER_DELAY_MS + 1, onProgress: () => { progress++; } }))
    .rejects.toBeInstanceOf(ZdpUploadConfigurationError);
  expect(progress).toBe(0);
});

test('maximum supported timeout and retry wait are accepted', () => {
  expect(() => createZdpSignedUploadClient({
    ...options, defaultTimeoutMs: MAX_TIMER_DELAY_MS,
    retryPolicy: { baseDelayMs: MAX_TIMER_DELAY_MS, maxDelayMs: MAX_TIMER_DELAY_MS }
  })).not.toThrow();
});
