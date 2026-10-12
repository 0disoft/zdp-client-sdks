import { describe, expect, it } from 'bun:test';
import { createZdpClient, ZdpClientConfigurationError, ZdpProtocolError } from '../src/index';
import type { AccountPreferencesGetResponse } from '../src/index';

const metadata = {
  requestIdFactory: () => 'request_profile_test',
  traceIdFactory: () => 'trace_profile_test',
  getAccessToken: () => 'synthetic-test-access-token'
};

const emptyPreferences: AccountPreferencesGetResponse = {
  birth_year: null,
  interests: [],
  age_status: 'unknown',
  age_source: 'unknown',
  age_verified: false,
  age_as_of_year: 2026,
  interest_catalog_version: 'account-interests-v1'
};

describe('account preferences contract sync', () => {
  it('reads an empty profile and preserves explicit null and false', async () => {
    const client = createZdpClient({
      ...metadata,
      baseUrl: 'https://api.example.test',
      fetch: async (input, init) => {
        expect(String(input)).toBe('https://api.example.test/v1/account-settings/preferences');
        expect(init?.method).toBe('GET');
        return Response.json(emptyPreferences);
      }
    });
    expect(await client.core.account.preferences.get()).toEqual(emptyPreferences);
  });

  it('sends exact profile values and caller-provided consent without granting consent itself', async () => {
    const requests: RequestInit[] = [];
    const client = createZdpClient({
      ...metadata,
      baseUrl: 'https://api.example.test',
      fetch: async (_input, init) => {
        requests.push(init!);
        return new Response(null, { status: 204 });
      }
    });
    await client.core.account.preferences.update(
      { birth_year: 1998, interests: ['programming'] },
      { idempotencyKey: 'profile-update', headers: { 'x-zdp-profile-consent': 'account-optional-profile-v1' } }
    );
    await client.core.account.preferences.update(
      { birth_year: null, interests: [] }, { idempotencyKey: 'profile-clear' }
    );
    expect(JSON.parse(String(requests[0]?.body))).toEqual({ birth_year: 1998, interests: ['programming'] });
    expect(new Headers(requests[0]?.headers).get('x-zdp-profile-consent')).toBe('account-optional-profile-v1');
    expect(new Headers(requests[1]?.headers).has('x-zdp-profile-consent')).toBe(false);
    expect(JSON.parse(String(requests[1]?.body))).toEqual({ birth_year: null, interests: [] });
  });

  it('rejects malformed request fields before transport', async () => {
    let calls = 0;
    const client = createZdpClient({
      ...metadata,
      baseUrl: 'https://api.example.test',
      fetch: async () => { calls++; return Response.json(emptyPreferences); }
    });
    for (const payload of [
      { birth_year: '1998', interests: [] },
      { birth_year: 1998.5, interests: [] },
      { birth_year: null, interests: ['unlisted-interest'] },
      { birth_year: null, interests: [false] },
      { birth_year: null, interests: new Array(1) }
    ]) {
      await expect(client.core.account.preferences.update(
        payload as never, { idempotencyKey: 'invalid-profile' }
      )).rejects.toBeInstanceOf(ZdpClientConfigurationError);
    }
    expect(calls).toBe(0);
  });

  it('rejects responses that claim verified age or contain invalid profile values', async () => {
    for (const override of [
      { age_verified: true },
      { age_verified: 'false' },
      { birth_year: '1998' },
      { interests: ['unlisted-interest'] }
    ]) {
      const client = createZdpClient({
        ...metadata,
        baseUrl: 'https://api.example.test',
        fetch: async () => Response.json({ ...emptyPreferences, ...override })
      });
      await expect(client.core.account.preferences.get()).rejects.toBeInstanceOf(ZdpProtocolError);
    }
  });

  it('requires explicit registration age-policy inputs without inventing them', async () => {
    const bodies: unknown[] = [];
    const client = createZdpClient({
      ...metadata,
      baseUrl: 'https://api.example.test',
      fetch: async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({ registration_request_id: 'registration_test', next_step: 'check_email' }, { status: 202 });
      }
    });
    const oldInput = { login_id: 'synthetic-login', password: 'synthetic-password', policy_set_resolution_ref: 'resolution_test' };
    await expect(client.core.auth.registrations.create(
      oldInput as never, { idempotencyKey: 'registration_test' }
    )).rejects.toBeInstanceOf(ZdpClientConfigurationError);
    expect(bodies).toEqual([]);
    const input = { ...oldInput, minimum_age_confirmed: true, age_policy_ref: 'synthetic-policy-ref' };
    await client.core.auth.registrations.create(input, { idempotencyKey: 'registration_test' });
    expect(bodies).toEqual([input]);
  });
});
