import { describe, expect, it } from 'bun:test';
import { createZdpClient, ZdpClientConfigurationError } from '../src/index';

const ceremonyId = '00000000-0000-0000-0000-000000000001';
const completion = {
  ceremony_id: ceremonyId,
  credential: {
    id: 'AQ', rawId: 'AQ', type: 'public-key',
    response: { authenticatorData: 'AQ', clientDataJSON: 'AQ', signature: 'AQ', userHandle: 'AQ' },
    extensions: {}
  }
};
const session = {
  session_ref: 'synthetic-session', actor_ref: 'synthetic-actor', tenant_ref: 'synthetic-tenant',
  expires_at: '2026-10-02T00:00:00Z'
};

describe('passkey login SDK', () => {
  it('encodes browser-only bodies and exposes the new operation namespaces', async () => {
    const requests: Array<{ path: string; body: unknown; headers: Headers }> = [];
    const client = createZdpClient({
      baseUrl: 'https://account.example.test',
      requestIdFactory: () => 'synthetic-request', traceIdFactory: () => 'synthetic-trace',
      fetch: async (url, init) => {
        const path = new URL(String(url)).pathname;
        requests.push({ path, body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
        return path.endsWith('/begin')
          ? Response.json({ ceremony_id: ceremonyId, options: { publicKey: { challenge: 'synthetic-challenge' } } })
          : Response.json(session, { status: 201 });
      }
    });
    expect((await client.core.auth.passkeyLoginBegin.create()).ceremony_id).toBe(ceremonyId);
    expect(await client.core.auth.passkeyLoginComplete.create(completion)).toEqual(session);
    expect(requests.map(({ path, body }) => ({ path, body }))).toEqual([
      { path: '/v1/auth/passkey/login/begin', body: {} },
      { path: '/v1/auth/passkey/login/complete', body: completion }
    ]);
    expect(requests.every(request => !request.headers.has('authorization'))).toBe(true);
  });

  it('rejects a caller-supplied browser binding before sending a request', async () => {
    let calls = 0;
    const client = createZdpClient({
      baseUrl: 'https://account.example.test', requestIdFactory: () => 'synthetic-request', traceIdFactory: () => 'synthetic-trace',
      fetch: async () => { calls += 1; return Response.json(session, { status: 201 }); }
    });
    const injected = { ...completion, browser_binding: 'synthetic-binding' };
    await expect(client.core.auth.passkeyLoginComplete.create(injected)).rejects.toBeInstanceOf(ZdpClientConfigurationError);
    expect(calls).toBe(0);
  });

  for (const phase of ['begin', 'complete'] as const) {
    for (const failure of [429, 503, 'network'] as const) {
      it(`does not replay ${phase} after ${failure}, even with a key and retry policy`, async () => {
        let calls = 0;
        const client = createZdpClient({
          baseUrl: 'https://account.example.test', requestIdFactory: () => 'synthetic-request', traceIdFactory: () => 'synthetic-trace',
          idempotencyKeyFactory: () => 'synthetic-idempotency',
          retry: { maxAttempts: 3 },
          fetch: async () => {
            calls += 1;
            if (failure === 'network') throw new TypeError('Synthetic network failure');
            return Response.json({ code: 'authentication_failed', message: 'Synthetic failure', request_id: 'synthetic-request', trace_id: 'synthetic-trace' }, { status: failure, headers: { 'retry-after': '0' } });
          }
        });
        const result = phase === 'begin'
          ? client.call('core.auth.passkey_login_begin.create', { idempotencyKey: 'synthetic-explicit-key' })
          : client.call('core.auth.passkey_login_complete.create', completion, { idempotencyKey: 'synthetic-explicit-key' });
        await expect(result).rejects.toBeInstanceOf(Error);
        expect(calls).toBe(1);
      });
    }
  }
});
