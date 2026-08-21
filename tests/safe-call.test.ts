import { describe, expect, it } from 'bun:test';
import {
  ZdpProtocolError,
  ZdpTransportError,
  createZdpClient,
  createZdpSafeTypedFetchClient,
  defineZdpOperations
} from '../src/index';
import type {
  ZdpApiErrorCode,
  ZdpApiSafeCallResult,
  ZdpFetchLike,
  ZdpOperationDefinition
} from '../src/index';

interface CreateWidgetRequest {
  readonly name: string;
}

interface CreateWidgetResponse {
  readonly widgetId: string;
}

const widgetOperations = defineZdpOperations({
  'test.widgets.create': {
    operationId: 'test.widgets.create',
    method: 'POST',
    path: '/v1/widgets',
    successStatuses: [201],
    authRequired: false,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: ['conflict', 'rate_limited', 'retry_exhausted'],
    encodeRequest: (request) => ({ body: { name: request.name } }),
    decodeResponse: (response) => {
      if (!isRecord(response) || typeof response.widget_id !== 'string') {
        throw new Error('widget_id is required');
      }
      return { widgetId: response.widget_id };
    }
  } satisfies ZdpOperationDefinition<
    CreateWidgetRequest,
    CreateWidgetResponse,
    'conflict' | 'rate_limited' | 'retry_exhausted'
  >
});

type SessionCreateErrorCode = ZdpApiErrorCode<'core.auth.sessions.create'>;
type SessionCreateSafeErrorCode = Extract<
  ZdpApiSafeCallResult<'core.auth.sessions.create'>,
  { readonly ok: false }
>['error']['code'];

const declaredSessionCreateErrorCode: SessionCreateErrorCode = 'rate_limited';
const declaredSessionCreateSafeErrorCode: SessionCreateSafeErrorCode =
  'rate_limited';

// @ts-expect-error operation-specific error unions reject undeclared codes.
const undeclaredSessionCreateErrorCode: SessionCreateErrorCode =
  'server_added_without_contract';
void undeclaredSessionCreateErrorCode;

describe('typed safe calls', () => {
  it('returns decoded data with redacted response metadata', async () => {
    const client = createZdpSafeTypedFetchClient(widgetOperations, {
      baseUrl: 'https://api.example.test',
      fetch: async () =>
        new Response(JSON.stringify({ widget_id: 'widget_123' }), {
          status: 201,
          headers: {
            'content-type': 'application/json',
            'x-request-id': 'response_request_123',
            'x-trace-id': 'response_trace_123',
            'ratelimit-limit': '100',
            'x-ratelimit-remaining': '42',
            'ratelimit-reset': '1787220000',
            'retry-after': '3',
            'set-cookie': 'session=must-not-leak',
              }
        }),
      requestIdFactory: () => 'request_123',
      traceIdFactory: () => 'trace_123'
    });

    const result = await client.safeCall(
      'test.widgets.create',
      { name: 'Widget' },
      { idempotencyKey: 'idempotency_123' }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw result.error;
    }

    expect(result.data).toEqual({ widgetId: 'widget_123' });
    expect(result.response).toEqual({
      status: 201,
      headers: {
        'content-type': 'application/json',
        'ratelimit-limit': '100',
        'ratelimit-reset': '1787220000',
        'retry-after': '3',
        'x-ratelimit-remaining': '42',
        'x-request-id': 'response_request_123',
        'x-trace-id': 'response_trace_123',
        'x-visible': 'visible'
      },
      requestId: 'response_request_123',
      traceId: 'response_trace_123',
      rateLimit: {
        limit: 100,
        remaining: 42,
        reset: '1787220000',
        retryAfterSeconds: 3
      }
    });
    expect(result.response.headers['set-cookie']).toBeUndefined();
    expect(result.response.headers['x-visible']).toBeUndefined();
  });

  it('returns declared API errors as a discriminated result', async () => {
    const client = createZdpSafeTypedFetchClient(widgetOperations, {
      baseUrl: 'https://api.example.test',
      fetch: async () =>
        new Response(
          JSON.stringify({
            code: 'rate_limited',
            message: 'Retry later.',
            request_id: 'failed_request_123',
            trace_id: 'failed_trace_123',
            retry_after_seconds: 7
          }),
          {
            status: 429,
            headers: {
              'content-type': 'application/json',
              'retry-after': '9',
              'x-ratelimit-remaining': '0'
            }
          }
        ),
      requestIdFactory: () => 'request_123',
      traceIdFactory: () => 'trace_123'
    });

    const result = await client.safeCall(
      'test.widgets.create',
      { name: 'Widget' },
      { idempotencyKey: 'idempotency_123' }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected an API error result.');
    }

    const code: 'conflict' | 'rate_limited' | 'retry_exhausted' =
      result.error.code;
    expect(code).toBe('rate_limited');
    expect(result.error.status).toBe(429);
    expect(result.error.retryAfterSeconds).toBe(7);
    expect(result.response.requestId).toBe('failed_request_123');
    expect(result.response.traceId).toBe('failed_trace_123');
    expect(result.response.rateLimit).toEqual({
      limit: null,
      remaining: 0,
      reset: null,
      retryAfterSeconds: 7
    });
  });

  it('rejects undeclared server error codes as protocol drift', async () => {
    const client = createZdpSafeTypedFetchClient(widgetOperations, {
      baseUrl: 'https://api.example.test',
      fetch: async () =>
        new Response(
          JSON.stringify({
            code: 'server_added_without_contract',
            message: 'Unexpected error.',
            request_id: 'failed_request_123',
            trace_id: 'failed_trace_123'
          }),
          {
            status: 409,
            headers: { 'content-type': 'application/json' }
          }
        ),
      requestIdFactory: () => 'request_123',
      traceIdFactory: () => 'trace_123'
    });

    await expect(
      client.safeCall(
        'test.widgets.create',
        { name: 'Widget' },
        { idempotencyKey: 'idempotency_123' }
      )
    ).rejects.toBeInstanceOf(ZdpProtocolError);
  });

  it('does not turn transport failures into API error results', async () => {
    const fetchLike: ZdpFetchLike = async () => {
      throw new Error('network unavailable');
    };
    const client = createZdpSafeTypedFetchClient(widgetOperations, {
      baseUrl: 'https://api.example.test',
      fetch: fetchLike,
      requestIdFactory: () => 'request_123',
      traceIdFactory: () => 'trace_123'
    });

    await expect(
      client.safeCall(
        'test.widgets.create',
        { name: 'Widget' },
        { idempotencyKey: 'idempotency_123' }
      )
    ).rejects.toBeInstanceOf(ZdpTransportError);
  });

  it('preserves generated operation error unions in the domain facade', async () => {
    expect(declaredSessionCreateErrorCode).toBe('rate_limited');
    expect(declaredSessionCreateSafeErrorCode).toBe('rate_limited');

    const client = createZdpClient({
      baseUrl: 'https://api.example.test',
      fetch: async () =>
        new Response(
          JSON.stringify({
            code: 'rate_limited',
            message: 'Retry later.',
            request_id: 'failed_request_123',
            trace_id: 'failed_trace_123',
            retry_after_seconds: 5
          }),
          {
            status: 429,
            headers: { 'content-type': 'application/json' }
          }
        ),
      requestIdFactory: () => 'request_123',
      traceIdFactory: () => 'trace_123'
    });

    const result = await client.safeCall(
      'core.auth.sessions.create',
      {
        login_identifier: 'synthetic-login',
        verifier: 'synthetic-verifier'
      },
      { idempotencyKey: 'idempotency_123' }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected an API error result.');
    }

    const code: SessionCreateErrorCode = result.error.code;
    expect(code).toBe('rate_limited');
    expect(result.response.status).toBe(429);
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
