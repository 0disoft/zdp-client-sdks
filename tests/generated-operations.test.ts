import { describe, expect, it } from 'bun:test';
import {
  ZDP_TYPED_FETCH_OPERATION_MAP,
  createZdpApiClient,
  zdpTypedFetchOperations
} from '../src/index';
import { loadApiExportPlanHandoff } from '../src/sdk-generation-plan/api-input';
import type { ZdpFetchLike } from '../src/index';

describe('generated typed fetch operations', () => {
  it('mirrors the zdp-api-contracts typed fetch operation map handoff', async () => {
    const apiExportPlan = await loadApiExportPlanHandoff('../zdp-api-contracts');

    expect(toPlainRecord(ZDP_TYPED_FETCH_OPERATION_MAP)).toEqual(
      toPlainRecord(apiExportPlan.typedFetchOperationMap)
    );
    expect(Object.keys(zdpTypedFetchOperations).sort()).toEqual(
      [...apiExportPlan.operationIds].sort()
    );
  });

  it('connects generated operations to the typed fetch runtime', async () => {
    const captured: {
      url?: URL;
      init: RequestInit | undefined;
    } = { init: undefined };
    const fetchLike: ZdpFetchLike = async (input, init) => {
      captured.url = input instanceof URL ? input : new URL(String(input));
      captured.init = init;

      return new Response(
        JSON.stringify({
          session_ref: 'sess_123',
          actor_ref: 'actor_123',
          tenant_ref: 'tenant_123',
          expires_at: '2026-06-29T00:00:00Z'
        }),
        {
          status: 201,
          headers: { 'content-type': 'application/json' }
        }
      );
    };
    const client = createZdpApiClient({
      baseUrl: 'https://api.example.test',
      fetch: fetchLike
    });

    const response = await client.call(
      'core.auth.sessions.create',
      {
        body: {
          login_identifier: 'user@example.test',
          verifier: 'opaque-verifier'
        }
      },
      {
        requestId: 'req_123',
        traceId: 'trace_123',
        idempotencyKey: 'idem_123'
      }
    );

    expect(response).toEqual({
      session_ref: 'sess_123',
      actor_ref: 'actor_123',
      tenant_ref: 'tenant_123',
      expires_at: '2026-06-29T00:00:00Z'
    });
    expect(captured.url?.toString()).toBe(
      'https://api.example.test/v1/auth/sessions'
    );
    expect(captured.init?.method).toBe('POST');
    expect(captured.init?.body).toBe(
      JSON.stringify({
        login_identifier: 'user@example.test',
        verifier: 'opaque-verifier'
      })
    );

    const headers = new Headers(captured.init?.headers);
    expect(headers.get('x-request-id')).toBe('req_123');
    expect(headers.get('x-trace-id')).toBe('trace_123');
    expect(headers.get('idempotency-key')).toBe('idem_123');
  });

  it('keeps path parameter expansion for generated operation metadata', async () => {
    const captured: {
      url?: URL;
    } = {};
    const client = createZdpApiClient({
      baseUrl: 'https://api.example.test',
      fetch: async (input) => {
        captured.url = input instanceof URL ? input : new URL(String(input));

        return new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { 'content-type': 'application/json' }
        });
      }
    });

    await client.call(
      'core.auth.oauth_callbacks.accept',
      {
        pathParams: { provider: 'google oauth' },
        body: {
          provider: 'google',
          state_ref: 'state_123',
          callback_code: 'code_123'
        }
      },
      {
        requestId: 'req_123',
        traceId: 'trace_123',
        idempotencyKey: 'idem_123'
      }
    );

    expect(captured.url?.toString()).toBe(
      'https://api.example.test/v1/auth/oauth/callbacks/google%20oauth'
    );
  });
});

function toPlainRecord(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}
