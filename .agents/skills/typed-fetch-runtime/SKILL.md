# Typed Fetch Runtime Skill

## Use When

Typed fetch definitions, generated TypeScript models, operation namespace methods, request encoding, runtime field validation, auth helper behavior, timeout, abort signal, idempotency, or upload handoff changes.

## Procedure

1. Read `src/typed-fetch/**`, `contracts/sdk-surface.yaml`, `contracts/typescript-sdk-models.yaml`, `contracts/auth-helper.yaml`, and `contracts/upload-client.yaml`.
2. Keep API route and required/optional field source truth in `zdp-api-contracts`.
3. Keep TypeScript representation decisions explicit and synchronized with every operation-used schema.
4. Preserve standard error envelope, request id, trace id, timeout, abort, idempotency, and upload handoff semantics.
5. Do not add refresh token, session token, credential, provider secret, or final authorization ownership.
6. Verify nested operation methods, path/query/body encoding, and request/response field checks with `zdp_client_sdks_check`.
