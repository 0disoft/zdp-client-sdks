import { describe, expect, it } from 'bun:test';
import {
  ZdpUploadAbortedError,
  ZdpUploadProtocolError,
  ZdpUploadTimeoutError,
  ZdpUploadTransferError,
  ZdpUploadValidationError,
  createZdpSignedUploadClient
} from '../src/upload';
import type {
  ZdpPreparedUpload,
  ZdpUploadAuthorizationRequest,
  ZdpUploadCallContext,
  ZdpUploadCompletionRequest,
  ZdpUploadProgress
} from '../src/upload';

const FUTURE_EXPIRY = '2099-01-01T00:00:00.000Z';

describe('signed upload client', () => {
  it('authorizes, transfers, and completes with stable request metadata', async () => {
    const authorizationRequests: ZdpUploadAuthorizationRequest[] = [];
    const completionRequests: ZdpUploadCompletionRequest[] = [];
    const contexts: ZdpUploadCallContext[] = [];
    const progress: ZdpUploadProgress[] = [];
    let providerBody = '';

    const client = createZdpSignedUploadClient({
      limits: {
        maxFileSizeBytes: 1_024,
        allowedContentTypes: ['text/*']
      },
      fetch: async (input, init) => {
        expect(String(input)).toBe('https://upload.invalid/ephemeral');
        expect(init?.method).toBe('PUT');
        expect(init?.credentials).toBe('omit');
        expect(init?.redirect).toBe('error');

        const headers = new Headers(init?.headers);
        expect(headers.has('x-request-id')).toBe(false);
        expect(headers.has('x-trace-id')).toBe(false);
        expect(headers.has('idempotency-key')).toBe(false);

        if (!(init?.body instanceof Blob)) {
          throw new Error('Fetch upload transport must attach the source Blob.');
        }
        providerBody = await init.body.text();

        return new Response(null, {
          status: 204,
          headers: { etag: '"provider-etag"' }
        });
      },
      authorize: async (request, context) => {
        authorizationRequests.push(request);
        contexts.push(context);
        return preparedUpload({
          complete: async (completion, completeContext) => {
            completionRequests.push(completion);
            contexts.push(completeContext);
            return {
              uploadRef: completion.uploadRef,
              objectRef: 'object_123',
              state: 'ready'
            };
          }
        });
      }
    });

    const result = await client.upload(
      {
        source: new Blob(['hello'], { type: 'text/plain' }),
        fileName: 'hello.txt',
        metadata: { purpose: 'test' }
      },
      {
        requestId: 'request_123',
        traceId: 'trace_123',
        idempotencyKey: 'upload_123',
        onProgress: (event) => progress.push(event)
      }
    );

    expect(providerBody).toBe('hello');
    expect(result).toEqual({
      uploadRef: 'upload_ref_123',
      objectRef: 'object_123',
      state: 'ready',
      contentType: 'text/plain',
      sizeBytes: 5,
      checksum: {
        algorithm: 'sha256',
        value:
          '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
      }
    });
    expect(authorizationRequests[0]).toMatchObject({
      fileName: 'hello.txt',
      contentType: 'text/plain',
      sizeBytes: 5,
      metadata: { purpose: 'test' }
    });
    expect(completionRequests[0]?.provider).toEqual({
      status: 204,
      etag: '"provider-etag"'
    });
    expect(
      contexts.every(
        (context) =>
          context.requestId === 'request_123' &&
          context.traceId === 'trace_123' &&
          context.idempotencyKey === 'upload_123'
      )
    ).toBe(true);
    expect([...new Set(progress.map((event) => event.phase))]).toEqual([
      'hashing',
      'authorizing',
      'uploading',
      'completing',
      'completed'
    ]);
    expect(JSON.stringify(result)).not.toContain('upload.invalid');
  });

  it('rejects local size and content-type violations before authorization', async () => {
    let authorizationCalls = 0;
    const client = createZdpSignedUploadClient({
      limits: {
        maxFileSizeBytes: 4,
        allowedContentTypes: ['image/png']
      },
      authorize: async () => {
        authorizationCalls += 1;
        return preparedUpload();
      }
    });

    await expect(
      client.upload({
        source: new Blob(['hello'], { type: 'image/png' }),
        fileName: 'large.png'
      })
    ).rejects.toMatchObject({ code: 'file_too_large' });
    await expect(
      client.upload({
        source: new Blob(['x'], { type: 'text/plain' }),
        fileName: 'wrong.txt'
      })
    ).rejects.toMatchObject({ code: 'content_type_not_allowed' });
    expect(authorizationCalls).toBe(0);
  });

  it('enforces narrower limits returned by the authorization boundary', async () => {
    const client = createZdpSignedUploadClient({
      limits: {
        maxFileSizeBytes: 1_024,
        allowedContentTypes: ['image/*']
      },
      authorize: async () =>
        preparedUpload({
          maxFileSizeBytes: 2,
          allowedContentTypes: ['image/png']
        })
    });

    await expect(
      client.upload({
        source: new Blob(['abc'], { type: 'image/png' }),
        fileName: 'image.png'
      })
    ).rejects.toBeInstanceOf(ZdpUploadValidationError);
  });

  it('retries only replay-safe provider transfers', async () => {
    let replaySafeAttempts = 0;
    const replaySafeClient = createZdpSignedUploadClient({
      limits: {
        maxFileSizeBytes: 1_024,
        allowedContentTypes: ['text/plain']
      },
      retryPolicy: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
      transfer: async () => {
        replaySafeAttempts += 1;
        return new Response(null, {
          status: replaySafeAttempts === 1 ? 503 : 204
        });
      },
      authorize: async () => preparedUpload({ replaySafe: true })
    });

    await expect(
      replaySafeClient.upload({
        source: new Blob(['x'], { type: 'text/plain' }),
        fileName: 'retry.txt'
      })
    ).resolves.toMatchObject({ state: 'ready' });
    expect(replaySafeAttempts).toBe(2);

    let unsafeAttempts = 0;
    const unsafeClient = createZdpSignedUploadClient({
      limits: {
        maxFileSizeBytes: 1_024,
        allowedContentTypes: ['text/plain']
      },
      retryPolicy: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 },
      transfer: async () => {
        unsafeAttempts += 1;
        return new Response(null, { status: 503 });
      },
      authorize: async () => preparedUpload({ replaySafe: false })
    });

    await expect(
      unsafeClient.upload({
        source: new Blob(['x'], { type: 'text/plain' }),
        fileName: 'no-retry.txt'
      })
    ).rejects.toMatchObject({ attempts: 1, status: 503 });
    expect(unsafeAttempts).toBe(1);
  });

  it('rejects provider requests that could leak client credentials', async () => {
    const client = createZdpSignedUploadClient({
      limits: {
        maxFileSizeBytes: 1_024,
        allowedContentTypes: ['text/plain']
      },
      authorize: async () =>
        preparedUpload({
          createRequest: () =>
            new Request('https://upload.invalid/ephemeral', {
              method: 'PUT',
              headers: { authorization: 'synthetic' }
            })
        })
    });

    await expect(
      client.upload({
        source: new Blob(['x'], { type: 'text/plain' }),
        fileName: 'unsafe.txt'
      })
    ).rejects.toBeInstanceOf(ZdpUploadProtocolError);
  });

  it('maps timeout and caller cancellation to upload-specific errors', async () => {
    const createClient = (defaultTimeoutMs: number) =>
      createZdpSignedUploadClient({
        limits: {
          maxFileSizeBytes: 1_024,
          allowedContentTypes: ['text/plain']
        },
        defaultTimeoutMs,
        transfer: ({ signal }) =>
          new Promise<Response>((_resolve, reject) => {
            const abort = () =>
              reject(new DOMException('aborted', 'AbortError'));
            if (signal.aborted) {
              abort();
              return;
            }
            signal.addEventListener('abort', abort, { once: true });
          }),
        authorize: async () => preparedUpload({ replaySafe: false })
      });

    await expect(
      createClient(1).upload({
        source: new Blob(['x'], { type: 'text/plain' }),
        fileName: 'timeout.txt'
      })
    ).rejects.toBeInstanceOf(ZdpUploadTimeoutError);

    const controller = new AbortController();
    controller.abort();
    await expect(
      createClient(1_000).upload(
        {
          source: new Blob(['x'], { type: 'text/plain' }),
          fileName: 'aborted.txt'
        },
        { signal: controller.signal }
      )
    ).rejects.toBeInstanceOf(ZdpUploadAbortedError);
  });

  it('does not expose provider failures or URLs in transfer errors', async () => {
    const client = createZdpSignedUploadClient({
      limits: {
        maxFileSizeBytes: 1_024,
        allowedContentTypes: ['text/plain']
      },
      retryPolicy: { maxAttempts: 1 },
      transfer: async () =>
        new Response('provider internal failure', { status: 500 }),
      authorize: async () => preparedUpload({ replaySafe: true })
    });

    try {
      await client.upload({
        source: new Blob(['x'], { type: 'text/plain' }),
        fileName: 'failed.txt'
      });
      throw new Error('Expected upload to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ZdpUploadTransferError);
      expect(String((error as Error).message)).not.toContain(
        'provider internal failure'
      );
      expect(JSON.stringify(error)).not.toContain('upload.invalid');
    }
  });
});

function preparedUpload(
  overrides: Partial<ZdpPreparedUpload> = {}
): ZdpPreparedUpload {
  return {
    uploadRef: 'upload_ref_123',
    expiresAt: FUTURE_EXPIRY,
    replaySafe: true,
    maxFileSizeBytes: 1_024,
    allowedContentTypes: ['text/plain'],
    createRequest: () =>
      new Request('https://upload.invalid/ephemeral', { method: 'PUT' }),
    complete: async (request) => ({
      uploadRef: request.uploadRef,
      objectRef: 'object_123',
      state: 'ready'
    }),
    ...overrides
  };
}
