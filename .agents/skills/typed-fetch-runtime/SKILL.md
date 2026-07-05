# Typed Fetch Runtime Skill

## Use When

Typed fetch operation definitions, runtime options, error normalization, auth helper behavior, timeout, abort signal, idempotency, or upload handoff changes.

## Procedure

1. Read `src/typed-fetch/**`, `contracts/sdk-surface.yaml`, `contracts/auth-helper.yaml`, and `contracts/upload-client.yaml`.
2. Keep API source truth in `zdp-api-contracts`.
3. Preserve standard error envelope, request id, trace id, timeout, abort, idempotency, and upload handoff semantics.
4. Do not add refresh token, session token, credential, provider secret, or final authorization ownership.
5. Verify with `zdp_client_sdks_check`.
