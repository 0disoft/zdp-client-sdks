import { expect, test } from 'bun:test';
import { getEventListeners } from 'node:events';
import { createZdpSignedUploadClient, ZdpUploadAbortedError, ZdpUploadTimeoutError } from '../src/upload';
import type { ZdpPreparedUpload, ZdpUploadChecksum, ZdpUploadProgress } from '../src/upload';

const phases = ['checksum', 'authorization', 'transfer', 'cleanup', 'completion'] as const;
const checksum: ZdpUploadChecksum = { algorithm: 'sha256', value: '0'.repeat(64) };
for (const mode of ['timeout', 'cancel'] as const) for (const phase of phases) test(`${mode} settles an uncooperative ${phase} step without retry or late advancement`, async () => {
  const controller = new AbortController(), progress: ZdpUploadProgress[] = [];
  let release!: () => void, enter!: () => void, signal!: AbortSignal;
  const gate = new Promise<void>(resolve => { release = resolve; }), entered = new Promise<void>(resolve => { enter = resolve; });
  let authorizations = 0, transfers = 0, completions = 0, discarded = 0;
  const pause = async (current?: AbortSignal) => { if (current) signal = current; enter(); await gate; };
  const prepared: ZdpPreparedUpload = {
    uploadRef: 'fixture-upload', expiresAt: null, replaySafe: true, maxFileSizeBytes: 100, allowedContentTypes: ['text/plain'],
    createRequest: () => new Request('https://upload.invalid/ephemeral', { method: 'PUT' }),
    complete: async (_request, context) => { completions++; if (phase === 'completion') await pause(context.signal); return { uploadRef: 'fixture-upload', objectRef: 'fixture-object', state: 'ready' }; }
  };
  const client = createZdpSignedUploadClient({
    limits: { maxFileSizeBytes: 100, allowedContentTypes: ['text/plain'] }, defaultTimeoutMs: mode === 'timeout' ? 25 : 10000,
    retryPolicy: { maxAttempts: 3, baseDelayMs: 1 },
    checksumProvider: async input => { await pause(input.signal); return checksum; },
    authorize: async (_input, context) => { authorizations++; if (phase === 'authorization') await pause(context.signal); return prepared; },
    transfer: async input => {
      transfers++; signal = input.signal;
      if (phase === 'transfer') { await pause(input.signal); input.onProgress(1, 1); }
      return new Response(new ReadableStream({
        start(value) { value.enqueue(new TextEncoder().encode('private-provider-fixture')); },
        async cancel() { discarded++; if (phase === 'cleanup') await pause(); }
      }), { status: 200 });
    }
  });
  const outcome = client.upload({ source: new Blob(['x'], { type: 'text/plain' }), fileName: 'fixture.txt', ...(phase === 'checksum' ? {} : { checksum }) },
    { signal: controller.signal, requestId: 'fixture-request', traceId: 'fixture-trace', idempotencyKey: 'fixture-key', onProgress: event => progress.push(event) }).then(value => value, error => error);
  try {
    await entered; if (mode === 'cancel') controller.abort();
    const ceiling = Symbol('upload-wait-exceeded'), result = await Promise.race([outcome, Bun.sleep(150).then(() => ceiling)]);
    expect(result).not.toBe(ceiling);
    expect(result).toBeInstanceOf(mode === 'timeout' ? ZdpUploadTimeoutError : ZdpUploadAbortedError);
    expect(result).toMatchObject({ requestId: 'fixture-request', traceId: 'fixture-trace', uploadRef: ['checksum', 'authorization'].includes(phase) ? null : 'fixture-upload' });
    expect(signal.aborted).toBe(true); expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
    const counts = [authorizations, transfers, completions], displayed = progress.length;
    release(); await Bun.sleep(0);
    expect([authorizations, transfers, completions]).toEqual(counts); expect(progress).toHaveLength(displayed);
    expect(completions).toBe(phase === 'completion' ? 1 : 0); expect(transfers).toBeLessThanOrEqual(1);
    if (phase === 'transfer') expect(discarded).toBe(1);
    expect(JSON.stringify(result)).not.toContain('private-provider-fixture'); expect(JSON.stringify(result)).not.toContain('upload.invalid');
  } finally { release(); await outcome; }
});
