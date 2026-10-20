import { expect, test } from 'bun:test';
import {
  createZdpFetchUploadTransport,
  createZdpSignedUploadClient,
  ZdpUploadConfigurationError
} from '../src/upload';

for (const path of ['transport', 'sdk-fetch', 'sdk-transfer'] as const) {
  for (const cleanup of ['pending', 'reject'] as const) {
    test(`${path} cancels the response after a progress error with ${cleanup} cleanup`, async () => {
      const failure = new Error('fixture progress failure');
      let cancelled = 0;
      let transfers = 0;
      let completions = 0;
      const response = new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('private-provider-fixture')); },
        cancel() {
          cancelled++;
          return cleanup === 'pending'
            ? new Promise<void>(() => {})
            : Promise.reject(new Error('fixture cleanup failure'));
        }
      }), { status: 200 });
      const source = new Blob(['x'], { type: 'text/plain' });
      const transfer = async () => { transfers++; return response; };
      let pending: Promise<unknown>;
      if (path === 'transport') {
        pending = createZdpFetchUploadTransport({ fetch: transfer })({
          request: new Request('https://upload.invalid/fixture', { method: 'PUT' }),
          body: source, signal: new AbortController().signal, totalBytes: source.size,
          onProgress: loaded => { if (loaded === source.size) throw failure; }
        });
      } else {
        const client = createZdpSignedUploadClient({
          limits: { maxFileSizeBytes: 100, allowedContentTypes: ['text/plain'] },
          ...(path === 'sdk-fetch' ? { fetch: transfer } : { transfer }),
          retryPolicy: { maxAttempts: 3, baseDelayMs: 0 },
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
        pending = client.upload({ source, fileName: 'fixture.txt', checksum: { algorithm: 'sha256', value: '0'.repeat(64) } }, {
          onProgress: progress => {
            if (progress.phase === 'uploading' && progress.loadedBytes === source.size) throw failure;
          }
        });
      }
      const result = await Promise.race([
        pending.then(value => value, error => error),
        Bun.sleep(200).then(() => 'still pending')
      ]);
      if (path === 'transport') expect(result).toBe(failure);
      else expect(result).toBeInstanceOf(ZdpUploadConfigurationError);
      expect(cancelled).toBe(1);
      expect(transfers).toBe(1);
      expect(completions).toBe(0);
      expect(String(result)).not.toContain('private-provider-fixture');
    });
  }
}
