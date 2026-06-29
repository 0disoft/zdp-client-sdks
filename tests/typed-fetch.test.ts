import { describe, expect, it } from 'bun:test';
import {
  ZdpApiError,
  ZdpClientConfigurationError,
  ZdpProtocolError,
  ZdpRequestAbortedError,
  ZdpRequestTimeoutError,
  createZdpTypedFetchClient,
  defineZdpOperation,
  defineZdpOperations
} from '../src/index';
import type { ZdpFetchLike } from '../src/index';

interface CreateSessionRequest {
  readonly accountId: string;
  readonly email: string;
  readonly scopes?: readonly string[];
}

interface CreateSessionResponse {
  readonly sessionId: string;
}

interface ReadProfileRequest {
  readonly profileId: string;
}

interface ReadProfileResponse {
  readonly profileId: string;
}

const operations = defineZdpOperations({
  'core.auth.sessions.create': defineZdpOperation<
    CreateSessionRequest,
    CreateSessionResponse
  >({
    operationId: 'core.auth.sessions.create',
    method: 'POST',
    path: '/v1/accounts/{accountId}/sessions',
    successStatuses: [201],
    authRequired: false,
    idempotency: 'required_idempotency_key',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: ['validation_failed', 'conflict'],
    encodeRequest: (request) => ({
      pathParams: { accountId: request.accountId },
      query: { scope: request.scopes },
      body: { email: request.email }
    }),
    decodeResponse: (response) => {
      if (!isRecord(response) || typeof response.session_id !== 'string') {
        throw new Error('session_id is required');
      }

      return { sessionId: response.session_id };
    }
  }),
  'core.profiles.read': defineZdpOperation<
    ReadProfileRequest,
    ReadProfileResponse
  >({
    operationId: 'core.profiles.read',
    method: 'GET',
    path: '/v1/profiles/{profileId}',
    successStatuses: [200],
    authRequired: true,
    idempotency: 'not_required',
    requestIdRequired: true,
    traceIdRequired: true,
    errorCodes: ['authentication_failed', 'not_found'],
    encodeRequest: (request) => ({
      pathParams: { profileId: request.profileId }
    }),
    decodeResponse: (response) => {
      if (!isRecord(response) || typeof response.profile_id !== 'string') {
        throw new Error('profile_id is required');
      }

      return { profileId: response.profile_id };
    }
  })
});

describe('typed fetch client', () => {
  it('calls a typed operation and propagates request, trace, and idempotency headers', async () => {
    const captured: {
      url?: URL;
      init?: RequestInit;
    } = {};
    const fetchLike: ZdpFetchLike = async (input, init) => {
      captured.url = input instanceof URL ? input : new URL(String(input));
      if (init !== undefined) {
        captured.init = init;
      }

      return jsonResponse({ session_id: 'sess_123' }, 201);
    };
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      fetch: fetchLike
    });

    const response = await client.call(
      'core.auth.sessions.create',
      {
        accountId: 'acct one',
        email: 'user@example.test',
        scopes: ['read', 'write']
      },
      {
        requestId: 'req_123',
        traceId: 'trace_123',
        idempotencyKey: 'idem_123'
      }
    );

    expect(response).toEqual({ sessionId: 'sess_123' });
    expect(captured.url?.toString()).toBe(
      'https://api.example.test/v1/accounts/acct%20one/sessions?scope=read&scope=write'
    );
    expect(captured.init?.method).toBe('POST');
    expect(captured.init?.body).toBe(
      JSON.stringify({ email: 'user@example.test' })
    );

    const headers = new Headers(captured.init?.headers);
    expect(headers.get('x-request-id')).toBe('req_123');
    expect(headers.get('x-trace-id')).toBe('trace_123');
    expect(headers.get('idempotency-key')).toBe('idem_123');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('requires idempotency keys for operations that declare them', async () => {
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      fetch: async () => jsonResponse({ session_id: 'unused' }, 201),
      requestIdFactory: () => 'req_123',
      traceIdFactory: () => 'trace_123'
    });

    await expect(
      client.call('core.auth.sessions.create', {
        accountId: 'acct_123',
        email: 'user@example.test'
      })
    ).rejects.toBeInstanceOf(ZdpClientConfigurationError);
  });

  it('attaches access tokens only for operations that require auth', async () => {
    const captured: {
      headers?: Headers;
    } = {};
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      fetch: async (_input, init) => {
        captured.headers = new Headers(init?.headers);

        return jsonResponse({ profile_id: 'profile_123' }, 200);
      },
      requestIdFactory: () => 'req_123',
      traceIdFactory: () => 'trace_123',
      getAccessToken: () => 'access_123'
    });

    await expect(
      client.call('core.profiles.read', { profileId: 'profile_123' })
    ).resolves.toEqual({ profileId: 'profile_123' });

    expect(captured.headers?.get('authorization')).toBe('Bearer access_123');
  });

  it('fails before fetch when an authenticated operation has no token provider', async () => {
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      fetch: async () => jsonResponse({ profile_id: 'unused' }, 200),
      requestIdFactory: () => 'req_123',
      traceIdFactory: () => 'trace_123'
    });

    await expect(
      client.call('core.profiles.read', { profileId: 'profile_123' })
    ).rejects.toBeInstanceOf(ZdpClientConfigurationError);
  });

  it('normalizes standard API error envelopes', async () => {
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      fetch: async () =>
        jsonResponse(
          {
            code: 'conflict',
            message: 'Session already exists.',
            request_id: 'req_failed',
            trace_id: 'trace_failed',
            retry_after_seconds: 10
          },
          409
        ),
      requestIdFactory: () => 'req_123',
      traceIdFactory: () => 'trace_123'
    });

    try {
      await client.call(
        'core.auth.sessions.create',
        {
          accountId: 'acct_123',
          email: 'user@example.test'
        },
        { idempotencyKey: 'idem_123' }
      );
      throw new Error('Expected call to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ZdpApiError);
      expect((error as ZdpApiError).status).toBe(409);
      expect((error as ZdpApiError).code).toBe('conflict');
      expect((error as ZdpApiError).requestId).toBe('req_failed');
      expect((error as ZdpApiError).traceId).toBe('trace_failed');
      expect((error as ZdpApiError).retryAfterSeconds).toBe(10);
    }
  });

  it('rejects error envelopes that expose forbidden fields', async () => {
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      fetch: async () =>
        jsonResponse(
          {
            code: 'internal_error',
            message: 'Internal error.',
            request_id: 'req_failed',
            trace_id: 'trace_failed',
            raw_provider_error: { provider: 'do-not-leak' }
          },
          500
        ),
      requestIdFactory: () => 'req_123',
      traceIdFactory: () => 'trace_123'
    });

    await expect(
      client.call(
        'core.auth.sessions.create',
        {
          accountId: 'acct_123',
          email: 'user@example.test'
        },
        { idempotencyKey: 'idem_123' }
      )
    ).rejects.toBeInstanceOf(ZdpProtocolError);
  });

  it('maps timeout aborts to timeout errors', async () => {
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      fetch: rejectWhenAborted,
      defaultTimeoutMs: 1,
      requestIdFactory: () => 'req_123',
      traceIdFactory: () => 'trace_123'
    });

    await expect(
      client.call(
        'core.auth.sessions.create',
        {
          accountId: 'acct_123',
          email: 'user@example.test'
        },
        { idempotencyKey: 'idem_123' }
      )
    ).rejects.toBeInstanceOf(ZdpRequestTimeoutError);
  });

  it('maps caller aborts to aborted request errors', async () => {
    const controller = new AbortController();
    controller.abort();
    const client = createZdpTypedFetchClient(operations, {
      baseUrl: 'https://api.example.test',
      fetch: rejectWhenAborted,
      requestIdFactory: () => 'req_123',
      traceIdFactory: () => 'trace_123'
    });

    await expect(
      client.call(
        'core.auth.sessions.create',
        {
          accountId: 'acct_123',
          email: 'user@example.test'
        },
        {
          idempotencyKey: 'idem_123',
          signal: controller.signal
        }
      )
    ).rejects.toBeInstanceOf(ZdpRequestAbortedError);
  });
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function rejectWhenAborted(_input: string | URL | Request, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    const rejectAbort = () => reject(new DOMException('aborted', 'AbortError'));

    if (signal?.aborted === true) {
      rejectAbort();
      return;
    }

    signal?.addEventListener('abort', rejectAbort, { once: true });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
