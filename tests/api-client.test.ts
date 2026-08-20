import { describe, expect, it } from 'bun:test';
import {
  ZDP_API_SCHEMA_MODEL_MAP,
  ZDP_API_SCHEMA_RUNTIME_TYPE_MAP,
  ZDP_TYPED_FETCH_OPERATION_MAP,
  ZdpClientConfigurationError,
  ZdpProtocolError,
  createZdpClient
} from '../src/index';
import type { ZdpApiRequest, ZdpFetchLike } from '../src/index';

describe('generated TypeScript API client', () => {
  it('exposes nested operation methods and encodes POST bodies', async () => {
    const captured: { readonly requests: Array<{ url: URL; init?: RequestInit }> } = {
      requests: []
    };
    const client = createZdpClient({
      baseUrl: 'https://api.example.test',
      fetch: captureFetch(captured, {
        session_ref: 'session_123',
        actor_ref: 'actor_123',
        tenant_ref: 'tenant_123',
        expires_at: '2026-08-20T12:00:00Z'
      }, 201),
      requestIdFactory: () => 'request_123',
      traceIdFactory: () => 'trace_123'
    });

    const response = await client.core.auth.sessions.create(
      {
        login_identifier: 'synthetic-login',
        verifier: 'synthetic-verifier'
      },
      { idempotencyKey: 'idempotency_123' }
    );

    expect(response.session_ref).toBe('session_123');
    const request = captured.requests[0];
    expect(request?.url.toString()).toBe('https://api.example.test/v1/auth/sessions');
    expect(request?.init?.body).toBe(
      JSON.stringify({
        login_identifier: 'synthetic-login',
        verifier: 'synthetic-verifier'
      })
    );
  });

  it('moves path fields out of GET query parameters', async () => {
    const captured: { readonly requests: Array<{ url: URL; init?: RequestInit }> } = {
      requests: []
    };
    const client = createZdpClient({
      baseUrl: 'https://api.example.test',
      fetch: captureFetch(captured, {
        projection_ref: 'projection_123',
        product_ref: 'product_123',
        scope_type: 'account',
        scope_ref: 'account_123',
        environment: 'production',
        locale: 'ko-KR',
        catalog_version: 'catalog_1',
        currency: 'KRW',
        ship_tiers: [{ id: 'tier_1' }],
        sales_status: 'available',
        projected_at: '2026-08-20T11:00:00Z',
        expires_at: '2026-08-20T11:05:00Z'
      }, 200),
      getAccessToken: () => 'synthetic-access-token',
      requestIdFactory: () => 'request_123',
      traceIdFactory: () => 'trace_123'
    });

    await client.money.creditPackCatalogProjections.get({
      product_ref: 'product_123',
      scope_type: 'account',
      scope_ref: 'account_123',
      environment: 'production',
      locale: 'ko-KR'
    });

    expect(captured.requests[0]?.url.toString()).toBe(
      'https://api.example.test/v1/credit-pack-catalog-projections/product_123' +
        '?scope_type=account&scope_ref=account_123&environment=production&locale=ko-KR'
    );
  });

  it('adds operation path parameters that are absent from the body schema', async () => {
    const captured: { readonly requests: Array<{ url: URL; init?: RequestInit }> } = {
      requests: []
    };
    const client = createZdpClient({
      baseUrl: 'https://api.example.test',
      fetch: captureFetch(captured, {
        verification_ref: 'verification_123',
        product_ref: 'product_123',
        environment: 'production',
        action: 'signup',
        verified_at: '2026-08-20T11:00:00Z',
        expires_at: '2026-08-20T11:05:00Z'
      }, 200),
      requestIdFactory: () => 'request_123',
      traceIdFactory: () => 'trace_123'
    });

    await client.platform.abuse.challenges.redeem(
      {
        challenge_ref: 'challenge_123',
        product_ref: 'product_123',
        environment: 'production',
        action: 'signup',
        challenge_response: 'synthetic-challenge-response'
      },
      { idempotencyKey: 'idempotency_123' }
    );

    expect(captured.requests[0]?.url.toString()).toBe(
      'https://api.example.test/v1/abuse/challenges/challenge_123/redeem'
    );
    expect(captured.requests[0]?.init?.body).toBe(
      JSON.stringify({
        product_ref: 'product_123',
        environment: 'production',
        action: 'signup',
        challenge_response: 'synthetic-challenge-response'
      })
    );
  });

  it('omits request objects for operations with no request fields', async () => {
    const client = createZdpClient({
      baseUrl: 'https://api.example.test',
      fetch: async () =>
        new Response(
          JSON.stringify({
            status: 'healthy',
            checked_at: '2026-08-20T11:00:00Z',
            adapter_status: 'healthy',
            state_store_status: 'healthy'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        ),
      getAccessToken: () => 'synthetic-access-token',
      requestIdFactory: () => 'request_123',
      traceIdFactory: () => 'trace_123'
    });

    await expect(client.platform.abuse.health.get()).resolves.toEqual({
      status: 'healthy',
      checked_at: '2026-08-20T11:00:00Z',
      adapter_status: 'healthy',
      state_store_status: 'healthy'
    });
  });

  it('rejects request values that do not match generated field types', async () => {
    const client = createZdpClient({
      baseUrl: 'https://api.example.test',
      fetch: async () => new Response(null, { status: 500 }),
      requestIdFactory: () => 'request_123',
      traceIdFactory: () => 'trace_123'
    });
    const invalidRequest = {
      product_ref: 'product_123',
      client_instance_ref: 'client_123',
      client_correlation_ref: 'correlation_123',
      proof_challenge: 'proof_123',
      requested_scope_refs: 'read'
    } as unknown as ZdpApiRequest<'core.auth.product_link_challenges.create'>;

    await expect(
      client.core.auth.productLinkChallenges.create(invalidRequest, {
        idempotencyKey: 'idempotency_123'
      })
    ).rejects.toBeInstanceOf(ZdpClientConfigurationError);
  });

  it('rejects response values that contradict generated models', async () => {
    const client = createZdpClient({
      baseUrl: 'https://api.example.test',
      fetch: async () =>
        new Response(
          JSON.stringify({
            challenge_ref: 'challenge_123',
            verification_uri: 'https://example.test/verify',
            expires_at: '2026-08-20T11:05:00Z',
            poll_interval_seconds: 'five'
          }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        ),
      requestIdFactory: () => 'request_123',
      traceIdFactory: () => 'trace_123'
    });

    await expect(
      client.core.auth.productLinkChallenges.create(
        {
          product_ref: 'product_123',
          client_instance_ref: 'client_123',
          client_correlation_ref: 'correlation_123',
          proof_challenge: 'proof_123',
          requested_scope_refs: ['read']
        },
        { idempotencyKey: 'idempotency_123' }
      )
    ).rejects.toBeInstanceOf(ZdpProtocolError);
  });

  it('covers every operation schema with a synchronized runtime descriptor', () => {
    for (const operation of Object.values(ZDP_TYPED_FETCH_OPERATION_MAP)) {
      const requestModel = ZDP_API_SCHEMA_MODEL_MAP[operation.requestSchemaRef];
      const requestRuntime =
        ZDP_API_SCHEMA_RUNTIME_TYPE_MAP[operation.requestSchemaRef];
      expect(requestRuntime.requiredFields).toEqual(requestModel.requiredFields);
      expect(Object.keys(requestRuntime.fieldTypes)).toEqual([
        ...requestModel.requiredFields,
        ...requestModel.optionalFields
      ]);

      if (operation.responseSchemaRef !== null) {
        const responseModel =
          ZDP_API_SCHEMA_MODEL_MAP[operation.responseSchemaRef];
        const responseRuntime =
          ZDP_API_SCHEMA_RUNTIME_TYPE_MAP[operation.responseSchemaRef];
        expect(responseRuntime.requiredFields).toEqual(
          responseModel.requiredFields
        );
        expect(Object.keys(responseRuntime.fieldTypes)).toEqual([
          ...responseModel.requiredFields,
          ...responseModel.optionalFields
        ]);
      }
    }
  });
});

function captureFetch(
  captured: { readonly requests: Array<{ url: URL; init?: RequestInit }> },
  body: unknown,
  status: number
): ZdpFetchLike {
  return async (input, init) => {
    const request: { url: URL; init?: RequestInit } = {
      url: input instanceof URL ? input : new URL(String(input))
    };
    if (init !== undefined) {
      request.init = init;
    }
    captured.requests.push(request);

    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    });
  };
}
