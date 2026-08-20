import { describe, expect, it } from 'bun:test';
import {
  ZdpApiError,
  ZdpRequestAbortedError,
  createZdpTypedFetchClient,
  defineZdpOperation,
  defineZdpOperations
} from '../src/typed-fetch';
import type { ZdpFetchLike } from '../src/typed-fetch';

interface ItemRequest {
  readonly itemId: string;
}

interface ItemResponse {
  readonly itemId: string;
}

interface CreateItemRequest {
  readonly name: string;
}

const operations = defineZdpOperations({
  'core.items.get': defineZdpOperation<ItemRequest, ItemResponse>({
    operationId: 'core.items.get',
    method: 'GET',
    path: '/v1/items/{itemId}',
    successStatuses: [200],
    authRequired: false,
    idempotency: 'not_required',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: ['unavailable'],
    encodeRequest: (request) => ({
      pathParams: { itemId: request.itemId }
    }),
    decodeResponse: (response) => {
      if (!isRecord(response) || typeof response.item_id !== 'string') {
        throw new Error('item_id is required');
      }

      return { itemId: response.item_id };
    }
  }),
  'core.items.create': defineZdpOperation<
    CreateItemRequest,
    ItemResponse
  >({
    operationId: 'core.items.create',
    method: 'POST',
    path: '/v1/items',
    successStatuses: [201],
    authRequired: false,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: ['unavailable'],
    encodeRequest: (request) => ({ body: request }),
    decodeResponse: (response) => {
      if (!isRecord(response) || typeof response.item_id !== 'string') {
        throw new Error('item_id is required');
      }

      return { itemId: response.item_id };
    }
  }),
  'core.items.unsafe_create': defineZdpOperation<
    CreateItemRequest,
    ItemResponse
  >({
    operationId: 'core.items.unsafe_create',
    method: 'POST',
    path: '/v1/unsafe-items',
    successStatuses: [201],
    authRequired: false,
    idempotency: 'not_required',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: ['unavailable'],
    encodeRequest: (request) => ({ body: request }),
    decodeResponse: (response) => {
      if (!isRecord(response) || typeof response.item_id !== 'string') {
        throw new Error('item_id is required');
      }

      return { itemId: response.item_id };
    }
  })
});

describe('typed fetch retries', () => {
  it('retries GET transport failures and reuses logical call identifiers', async () => {
    let fetchCalls = 0;
    const capturedHeaders: Headers[] = [];
    const fetchLike: ZdpFetchLike = async (_input, init) => {
      fetchCalls += 1;
      capturedHeaders.push(new Headers(init?.headers));
      if (fetchCalls < 3) {
        throw new TypeError('Synthetic transport failure.');
      }

      return jsonResponse({ item_id: 'item_123' }, 200);
    };
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      fetch: fetchLike,
      requestIdFactory: () => 'req_retry',
      traceIdFactory: () => 'trace_retry',
      retry: immediateRetryPolicy(3)
    });

    await expect(
      client.call('core.items.get', { itemId: 'item_123' })
    ).resolves.toEqual({ itemId: 'item_123' });

    expect(fetchCalls).toBe(3);
    expect(
      capturedHeaders.map((headers) => headers.get('x-request-id'))
    ).toEqual(['req_retry', 'req_retry', 'req_retry']);
    expect(
      capturedHeaders.map((headers) => headers.get('x-trace-id'))
    ).toEqual(['trace_retry', 'trace_retry', 'trace_retry']);
  });

  it('creates one idempotency key and reuses it across mutation attempts', async () => {
    let fetchCalls = 0;
    let factoryCalls = 0;
    const capturedKeys: (string | null)[] = [];
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      requestIdFactory: () => 'req_create',
      traceIdFactory: () => 'trace_create',
      idempotencyKeyFactory: (operationId) => {
        factoryCalls += 1;
        expect(operationId).toBe('core.items.create');
        return 'idem_generated';
      },
      retry: immediateRetryPolicy(3),
      fetch: async (_input, init) => {
        fetchCalls += 1;
        capturedKeys.push(
          new Headers(init?.headers).get('idempotency-key')
        );
        if (fetchCalls === 1) {
          return retryableErrorResponse(503, { retry_after_seconds: 0 });
        }

        return jsonResponse({ item_id: 'item_created' }, 201);
      }
    });

    await expect(
      client.call('core.items.create', { name: 'Created item' })
    ).resolves.toEqual({ itemId: 'item_created' });

    expect(factoryCalls).toBe(1);
    expect(capturedKeys).toEqual(['idem_generated', 'idem_generated']);
  });

  it('does not retry a mutation without contract-backed idempotency', async () => {
    let fetchCalls = 0;
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      requestIdFactory: () => 'req_unsafe',
      traceIdFactory: () => 'trace_unsafe',
      retry: immediateRetryPolicy(3),
      fetch: async () => {
        fetchCalls += 1;
        return retryableErrorResponse(503, { retry_after_seconds: 0 });
      }
    });

    await expect(
      client.call(
        'core.items.unsafe_create',
        { name: 'Unsafe item' },
        { idempotencyKey: 'caller_supplied_but_not_contract_backed' }
      )
    ).rejects.toBeInstanceOf(ZdpApiError);
    expect(fetchCalls).toBe(1);
  });

  it('honors Retry-After response headers for retryable statuses', async () => {
    let fetchCalls = 0;
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      requestIdFactory: () => 'req_header',
      traceIdFactory: () => 'trace_header',
      retry: immediateRetryPolicy(2),
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) {
          return retryableErrorResponse(429, undefined, {
            'retry-after': '0'
          });
        }

        return jsonResponse({ item_id: 'item_after_retry' }, 200);
      }
    });

    await expect(
      client.call('core.items.get', { itemId: 'item_after_retry' })
    ).resolves.toEqual({ itemId: 'item_after_retry' });
    expect(fetchCalls).toBe(2);
  });

  it('returns the response without retrying when Retry-After exceeds the cap', async () => {
    let fetchCalls = 0;
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      requestIdFactory: () => 'req_capped',
      traceIdFactory: () => 'trace_capped',
      retry: {
        ...immediateRetryPolicy(3),
        maxRetryAfterMs: 500
      },
      fetch: async () => {
        fetchCalls += 1;
        return retryableErrorResponse(429, undefined, {
          'retry-after': '60'
        });
      }
    });

    await expect(
      client.call('core.items.get', { itemId: 'item_capped' })
    ).rejects.toBeInstanceOf(ZdpApiError);
    expect(fetchCalls).toBe(1);
  });

  it('allows a call to disable the client retry policy', async () => {
    let fetchCalls = 0;
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      requestIdFactory: () => 'req_disabled',
      traceIdFactory: () => 'trace_disabled',
      retry: immediateRetryPolicy(3),
      fetch: async () => {
        fetchCalls += 1;
        return retryableErrorResponse(503, { retry_after_seconds: 0 });
      }
    });

    await expect(
      client.call(
        'core.items.get',
        { itemId: 'item_disabled' },
        { retry: false }
      )
    ).rejects.toBeInstanceOf(ZdpApiError);
    expect(fetchCalls).toBe(1);
  });

  it('aborts during retry backoff without issuing another request', async () => {
    let fetchCalls = 0;
    const controller = new AbortController();
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      requestIdFactory: () => 'req_abort',
      traceIdFactory: () => 'trace_abort',
      retry: { maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 1_000 },
      fetch: async () => {
        fetchCalls += 1;
        queueMicrotask(() => controller.abort());
        return retryableErrorResponse(503);
      }
    });

    await expect(
      client.call(
        'core.items.get',
        { itemId: 'item_abort' },
        { signal: controller.signal }
      )
    ).rejects.toBeInstanceOf(ZdpRequestAbortedError);
    expect(fetchCalls).toBe(1);
  });
});

function immediateRetryPolicy(maxAttempts: number) {
  return {
    maxAttempts,
    baseDelayMs: 0,
    maxDelayMs: 0
  } as const;
}

function retryableErrorResponse(
  status: number,
  additionalBody: Readonly<Record<string, unknown>> | undefined = undefined,
  headers: Readonly<Record<string, string>> | undefined = undefined
): Response {
  return jsonResponse(
    {
      code: 'unavailable',
      message: 'Retry later.',
      request_id: 'req_server',
      trace_id: 'trace_server',
      ...additionalBody
    },
    status,
    headers
  );
}

function jsonResponse(
  body: unknown,
  status: number,
  headers: Readonly<Record<string, string>> | undefined = undefined
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
