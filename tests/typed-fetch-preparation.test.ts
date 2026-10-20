import { expect, test } from 'bun:test';
import { getEventListeners } from 'node:events';
import {
  createZdpTypedFetchClient,
  defineZdpOperation,
  ZdpClientConfigurationError,
  ZdpRequestAbortedError,
  ZdpRequestTimeoutError
} from '../src/index';

const operations = {
  profile: defineZdpOperation<Record<string, never>, unknown>({
    operationId: 'profile', method: 'GET', path: '/profile',
    successStatuses: [200], authRequired: true, idempotency: 'not_required',
    requestIdRequired: false, traceIdRequired: false, errorCodes: [],
    encodeRequest: () => ({}), decodeResponse: value => value
  })
};

for (const mode of ['timeout', 'cancel'] as const) {
  for (const late of ['resolve', 'reject'] as const) {
    test(`${mode} bounds token preparation with late ${late} and no request`, async () => {
      const caller = new AbortController();
      let enter!: () => void;
      const entered = new Promise<void>(resolve => { enter = resolve; });
      let resolveToken!: (token: string) => void;
      let rejectToken!: (error: Error) => void;
      const token = new Promise<string>((resolve, reject) => {
        resolveToken = resolve; rejectToken = reject;
      });
      let fetches = 0;
      let providers = 0;
      const client = createZdpTypedFetchClient(operations, {
        baseUrl: 'https://api.example.test',
        defaultTimeoutMs: mode === 'timeout' ? 25 : 10_000,
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 },
        getAccessToken: () => { providers++; enter(); return token; },
        fetch: async () => { fetches++; return Response.json({ ok: true }); }
      });
      const pending = client.call('profile', {}, { signal: caller.signal })
        .then(value => value, error => error);
      try {
        await entered;
        if (mode === 'cancel') caller.abort();
        const ceiling = Symbol('preparation-still-pending');
        const result = await Promise.race([pending, Bun.sleep(200).then(() => ceiling)]);
        expect(result).not.toBe(ceiling);
        expect(result).toBeInstanceOf(mode === 'timeout' ? ZdpRequestTimeoutError : ZdpRequestAbortedError);
        expect(getEventListeners(caller.signal, 'abort')).toHaveLength(0);
        if (late === 'resolve') resolveToken('fixture-access-token');
        else rejectToken(new Error('late provider failure'));
        await Bun.sleep(0);
        expect(fetches).toBe(0);
        expect(providers).toBe(1);
      } finally {
        caller.abort(); resolveToken('fixture-access-token');
      }
    });
  }
}

test('pre-aborted and invalid timeout calls do not invoke the token provider', async () => {
  let providers = 0;
  const client = createZdpTypedFetchClient(operations, {
    baseUrl: 'https://api.example.test',
    getAccessToken: () => { providers++; return 'fixture-access-token'; }
  });
  await expect(client.call('profile', {}, { signal: AbortSignal.abort() }))
    .rejects.toBeInstanceOf(ZdpRequestAbortedError);
  await expect(client.call('profile', {}, { timeoutMs: 0 }))
    .rejects.toBeInstanceOf(ZdpClientConfigurationError);
  expect(providers).toBe(0);
});

test('provider failures keep their original error and are not retried', async () => {
  const failure = new Error('provider failed');
  let providers = 0;
  const client = createZdpTypedFetchClient(operations, {
    baseUrl: 'https://api.example.test',
    retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 },
    getAccessToken: () => { providers++; throw failure; }
  });
  await expect(client.call('profile', {})).rejects.toBe(failure);
  expect(providers).toBe(1);
});

test('rejects default deadlines beyond the timer range at client creation', () => {
  expect(() => createZdpTypedFetchClient(operations, {
    baseUrl: 'https://api.example.test', defaultTimeoutMs: 2_147_483_648
  })).toThrow(ZdpClientConfigurationError);
});

test('rejects overflowing call deadlines before token preparation or transport', async () => {
  let providers = 0;
  let fetches = 0;
  const client = createZdpTypedFetchClient(operations, {
    baseUrl: 'https://api.example.test',
    getAccessToken: () => { providers++; return 'fixture-access-token'; },
    fetch: async () => { fetches++; return Response.json({ ok: true }); }
  });
  await expect(client.call('profile', {}, { timeoutMs: 2_147_483_648 }))
    .rejects.toBeInstanceOf(ZdpClientConfigurationError);
  expect(providers).toBe(0);
  expect(fetches).toBe(0);
});

test('accepts the maximum timer deadline as a default and a call override', async () => {
  const client = createZdpTypedFetchClient(operations, {
    baseUrl: 'https://api.example.test', defaultTimeoutMs: 2_147_483_647,
    getAccessToken: () => 'fixture-access-token',
    fetch: async () => Response.json({ ok: true })
  });
  await expect(client.call('profile', {})).resolves.toEqual({ ok: true });
  await expect(client.call('profile', {}, { timeoutMs: 2_147_483_647 }))
    .resolves.toEqual({ ok: true });
});

test('successful token preparation is reused across request retries', async () => {
  let providers = 0;
  let fetches = 0;
  const client = createZdpTypedFetchClient(operations, {
    baseUrl: 'https://api.example.test',
    retry: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
    getAccessToken: async () => { providers++; return 'fixture-access-token'; },
    fetch: async (_input, init) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fixture-access-token');
      fetches++;
      if (fetches === 1) {
        return new Response(null, { status: 503, headers: { 'retry-after': '0' } });
      }
      return Response.json({ ok: true });
    }
  });
  await expect(client.call('profile', {})).resolves.toEqual({ ok: true });
  expect(providers).toBe(1);
  expect(fetches).toBe(2);
});
