import { describe, expect, it } from 'bun:test';
import { getEventListeners } from 'node:events';
import {
  ZdpClientConfigurationError,
  ZdpProtocolError,
  createZdpTypedFetchClient,
  defineZdpOperation,
  defineZdpOperations
} from '../src/index';
import type { ZdpTypedFetchClientOptions } from '../src/index';

interface HealthResponse {
  readonly ok: boolean;
  readonly payload?: string;
}

const operations = defineZdpOperations({
  health: defineZdpOperation<Record<string, never>, HealthResponse>({
    operationId: 'health',
    method: 'GET',
    path: '/health',
    successStatuses: [200],
    authRequired: false,
    idempotency: 'not_required',
    requestIdRequired: false,
    traceIdRequired: false,
    errorCodes: ['unavailable'],
    encodeRequest: () => ({}),
    decodeResponse: (response) => {
      if (!isRecord(response) || typeof response.ok !== 'boolean') {
        throw new Error('ok is required');
      }
      if (
        response.payload !== undefined &&
        typeof response.payload !== 'string'
      ) {
        throw new Error('payload must be a string');
      }

      return response.payload === undefined
        ? { ok: response.ok }
        : { ok: response.ok, payload: response.payload };
    }
  })
});

describe('typed fetch runtime hardening', () => {
  it('rejects base URLs with embedded credentials without echoing them', () => {
    for (const baseUrl of [
      'https://user@api.example.test',
      'https://user:secret@api.example.test',
      'https://user:secret@'
    ]) {
      try {
        createZdpTypedFetchClient(operations, { baseUrl });
        throw new Error('Expected client creation to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(ZdpClientConfigurationError);
        if (!(error instanceof Error)) {
          throw error;
        }
        expect(error.message).not.toContain('secret');
      }
    }
  });

  it('rejects streamed JSON bodies that exceed the configured byte limit', async () => {
    const client = createHealthClient({
      maxResponseBodyBytes: 32,
      fetch: async () =>
        jsonResponse({ ok: true, payload: 'x'.repeat(128) }, 200)
    });

    try {
      await client.call('health', {});
      throw new Error('Expected response body limit failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(ZdpProtocolError);
      if (!(error instanceof ZdpProtocolError)) {
        throw error;
      }
      expect(error.status).toBe(200);
      expect(error.message).toContain('maxResponseBodyBytes');
    }
  });

  it('allows a call to raise the client response byte limit explicitly', async () => {
    const client = createHealthClient({
      maxResponseBodyBytes: 32,
      fetch: async () =>
        jsonResponse({ ok: true, payload: 'x'.repeat(128) }, 200)
    });

    await expect(
      client.call('health', {}, { maxResponseBodyBytes: 1_024 })
    ).resolves.toEqual({ ok: true, payload: 'x'.repeat(128) });
  });

  it('bounds retry response inspection before consuming a replacement response', async () => {
    let attempts = 0;
    const client = createHealthClient({
      maxResponseBodyBytes: 32,
      retry: {
        maxAttempts: 2,
        baseDelayMs: 0,
        maxDelayMs: 0
      },
      fetch: async () => {
        attempts += 1;
        return attempts === 1
          ? jsonResponse({ payload: 'x'.repeat(128) }, 503)
          : jsonResponse({ ok: true }, 200);
      }
    });

    await expect(client.call('health', {})).resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it('removes caller abort listeners after every completed request', async () => {
    const controller = new AbortController();
    const client = createHealthClient({
      fetch: async () => {
        expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);
        return jsonResponse({ ok: true }, 200);
      }
    });

    for (let index = 0; index < 20; index += 1) {
      await expect(
        client.call('health', {}, { signal: controller.signal })
      ).resolves.toEqual({ ok: true });
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
    }
  });

  it('rejects invalid response byte limits before calling fetch', async () => {
    expect(() =>
      createHealthClient({ maxResponseBodyBytes: 0 })
    ).toThrow(ZdpClientConfigurationError);

    let fetchCalls = 0;
    const client = createHealthClient({
      fetch: async () => {
        fetchCalls += 1;
        return jsonResponse({ ok: true }, 200);
      }
    });

    await expect(
      client.call('health', {}, { maxResponseBodyBytes: 0 })
    ).rejects.toBeInstanceOf(ZdpClientConfigurationError);
    expect(fetchCalls).toBe(0);
  });
});

function createHealthClient(
  options: Omit<ZdpTypedFetchClientOptions, 'baseUrl'> = {}
) {
  return createZdpTypedFetchClient(operations, {
    baseUrl: 'https://api.example.test',
    ...options
  });
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
