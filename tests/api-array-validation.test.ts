import { expect, test } from 'bun:test';
import { createZdpClient, ZdpClientConfigurationError } from '../src/index';
import type { AccountPreferencesUpdateRequest } from '../src/index';

const challenge = {
  challenge_ref: 'challenge_fixture', verification_uri: 'https://example.test/verify',
  expires_at: '2026-10-21T00:00:00Z', poll_interval_seconds: 5
};

for (const shape of ['empty slots', 'deleted slot'] as const) {
  test(`rejects string arrays with ${shape} before they become JSON nulls`, async () => {
    let fetches = 0;
    const client = createZdpClient({
      baseUrl: 'https://api.example.test',
      requestIdFactory: () => 'request_fixture', traceIdFactory: () => 'trace_fixture',
      fetch: async () => { fetches++; return Response.json(challenge, { status: 201 }); }
    });
    const scopes = shape === 'empty slots' ? new Array<string>(2) : ['read', 'write'];
    if (shape === 'deleted slot') delete scopes[1];
    expect(JSON.stringify(scopes)).toContain('null');
    await expect(client.core.auth.productLinkChallenges.create({
      product_ref: 'product_fixture', client_instance_ref: 'client_fixture',
      client_correlation_ref: 'correlation_fixture', proof_challenge: 'proof_fixture',
      requested_scope_refs: scopes
    }, { idempotencyKey: 'idempotency_fixture' })).rejects.toBeInstanceOf(ZdpClientConfigurationError);
    expect(fetches).toBe(0);
  });
}

test('validates indexed enum-array items instead of a custom iterator', async () => {
  let fetches = 0;
  const client = createZdpClient({
    baseUrl: 'https://api.example.test', getAccessToken: () => 'fixture-access-token',
    requestIdFactory: () => 'request_fixture', traceIdFactory: () => 'trace_fixture',
    fetch: async () => { fetches++; return new Response(null, { status: 204 }); }
  });
  const interests = ['technology', 'not-a-declared-interest'];
  interests[Symbol.iterator] = () => ['technology'][Symbol.iterator]();
  expect(JSON.stringify(interests)).toContain('not-a-declared-interest');
  await expect(client.core.account.preferences.update({ birth_year: null, interests } as AccountPreferencesUpdateRequest,
    { idempotencyKey: 'idempotency_fixture' })).rejects.toBeInstanceOf(ZdpClientConfigurationError);
  expect(fetches).toBe(0);
});

test('dense string arrays still serialize without changes', async () => {
  let body: unknown;
  const client = createZdpClient({
    baseUrl: 'https://api.example.test',
    requestIdFactory: () => 'request_fixture', traceIdFactory: () => 'trace_fixture',
    fetch: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json(challenge, { status: 201 });
    }
  });
  await client.core.auth.productLinkChallenges.create({
    product_ref: 'product_fixture', client_instance_ref: 'client_fixture',
    client_correlation_ref: 'correlation_fixture', proof_challenge: 'proof_fixture',
    requested_scope_refs: ['read', 'write']
  }, { idempotencyKey: 'idempotency_fixture' });
  expect(body).toMatchObject({ requested_scope_refs: ['read', 'write'] });
});
