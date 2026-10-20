import { expect, test } from 'bun:test';
import {
  createZdpClient,
  createZdpSafeTypedFetchClient,
  createZdpTypedFetchClient,
  defineZdpOperation,
  ZdpClientConfigurationError
} from '../src/index';

// JavaScript consumers can supply operation names outside the generated union.
type JavaScriptCall = (operationId: string, request: object) => Promise<unknown>;

const health = defineZdpOperation<Record<string, never>, unknown>({
  operationId: 'health', method: 'GET', path: '/health',
  successStatuses: [200], authRequired: false, idempotency: 'not_required',
  requestIdRequired: false, traceIdRequired: false, errorCodes: [],
  encodeRequest: () => ({}), decodeResponse: value => value
});

test('all public call surfaces reject missing and inherited operation names before fetch', async () => {
  let fetches = 0;
  const options = {
    baseUrl: 'https://api.example.test',
    fetch: async () => { fetches++; return Response.json({ ok: true }); }
  };
  const operations = Object.assign(Object.create({ inherited: health }), { health });
  const typed = createZdpTypedFetchClient(operations, options);
  const safe = createZdpSafeTypedFetchClient(operations, options);
  const domain = createZdpClient(options);
  for (const id of ['missing', 'toString', 'constructor', '__proto__', 'inherited']) {
    for (const invoke of [
      () => typed.call(id, {}),
      () => safe.safeCall(id, {}),
      () => (domain.call as JavaScriptCall)(id, {}),
      () => (domain.safeCall as JavaScriptCall)(id, {}),
      () => (domain.raw.call as JavaScriptCall)(id, {}),
      () => (domain.raw.safeCall as JavaScriptCall)(id, {})
    ]) {
      await expect(invoke()).rejects.toBeInstanceOf(ZdpClientConfigurationError);
    }
  }
  expect(fetches).toBe(0);
});

test('explicitly registered operation names still work with null prototypes and prototype-like keys', async () => {
  const operations = Object.assign(Object.create(null), { toString: health });
  const options = {
    baseUrl: 'https://api.example.test',
    fetch: async () => Response.json({ ok: true })
  };
  await expect(createZdpTypedFetchClient(operations, options).call('toString', {}))
    .resolves.toEqual({ ok: true });
  const result = await createZdpSafeTypedFetchClient(operations, options).safeCall('toString', {});
  expect(result).toMatchObject({ ok: true, data: { ok: true } });
});
