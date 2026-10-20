import { expect, test } from 'bun:test';
import {
  createZdpClient, createZdpTypedFetchClient, defineZdpOperation,
  ZdpClientConfigurationError
} from '../src/index';

const options = {
  baseUrl: 'https://api.example.test',
  requestIdFactory: () => 'request_fixture',
  traceIdFactory: () => 'trace_fixture'
};

const operations = {
  redeem: defineZdpOperation<{ ref: string }, unknown>({
    operationId: 'redeem', method: 'POST', path: '/v1/challenges/{ref}/redeem',
    successStatuses: [200], authRequired: false,
    idempotency: 'required_idempotency_key', requestIdRequired: true,
    traceIdRequired: true, errorCodes: ['invalid_request'],
    encodeRequest: request => ({ pathParams: { ref: request.ref } }),
    decodeResponse: response => response
  })
};

for (const ref of ['.', '..']) {
  test(`rejects ${JSON.stringify(ref)} path parameters before URL normalization changes the route`, async () => {
    let fetches = 0;
    const fetch = async () => {
      fetches++;
      return Response.json({
        verification_ref: 'verification_fixture', product_ref: 'product_fixture',
        environment: 'production', action: 'signup',
        verified_at: '2026-10-21T00:00:00Z', expires_at: '2026-10-21T00:05:00Z'
      });
    };
    const client = createZdpClient({ ...options, fetch });
    await expect(client.platform.abuse.challenges.redeem({
      challenge_ref: ref, product_ref: 'product_fixture', environment: 'production',
      action: 'signup', challenge_response: 'fixture-response'
    }, { idempotencyKey: 'fixture-key' })).rejects.toBeInstanceOf(ZdpClientConfigurationError);

    const raw = createZdpTypedFetchClient(operations, { ...options, fetch });
    await expect(raw.call('redeem', { ref }, { idempotencyKey: 'fixture-key' }))
      .rejects.toBeInstanceOf(ZdpClientConfigurationError);
    expect(fetches).toBe(0);
  });
}

test('preserves ordinary dots and escapes path separators, query markers and encoded dot text', async () => {
  const urls: string[] = [];
  const client = createZdpTypedFetchClient(operations, {
    ...options,
    fetch: async input => { urls.push(String(input)); return Response.json({ ok: true }); }
  });
  for (const ref of ['ref.123', '...', '../other?x#fragment', '%2e%2e']) {
    await client.call('redeem', { ref }, { idempotencyKey: 'fixture-key' });
    expect(urls.at(-1)).toBe(`https://api.example.test/v1/challenges/${encodeURIComponent(ref)}/redeem`);
  }
});

test('rejects dot segments in custom path templates, including encoded forms', async () => {
  let fetches = 0;
  for (const segment of ['.', '..', '%2E', '.%2e', '%2e.', '%2e%2E']) {
    const client = createZdpTypedFetchClient({
      redeem: defineZdpOperation({
        ...operations.redeem, path: `/v1/${segment}/challenges/{ref}/redeem`
      })
    }, {
      ...options,
      fetch: async () => { fetches++; return Response.json({ ok: true }); }
    });
    await expect(client.call('redeem', { ref: 'fixture' }, { idempotencyKey: 'fixture-key' }))
      .rejects.toBeInstanceOf(ZdpClientConfigurationError);
  }
  expect(fetches).toBe(0);
});

test('allows dot parameter values when they form part of an ordinary segment', async () => {
  let url = '';
  const client = createZdpTypedFetchClient({
    redeem: defineZdpOperation({ ...operations.redeem, path: '/v1/challenges/ref-{ref}/redeem' })
  }, {
    ...options,
    fetch: async input => { url = String(input); return Response.json({ ok: true }); }
  });
  await client.call('redeem', { ref: '..' }, { idempotencyKey: 'fixture-key' });
  expect(url).toBe('https://api.example.test/v1/challenges/ref-../redeem');
});
