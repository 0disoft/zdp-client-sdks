# Docs

`zdp-client-sdks` docs separate SDK generation planning from API contract ownership.

## Contracts

- `contracts/sdk-generation.md`: API generation input and dry-run plan handoff
- `contracts/typed-fetch-auth.md`: typed fetch, auth helper, and error envelope boundary
- `contracts/upload-client.md`: signed upload authorization, transfer, and completion runtime boundary
- `contracts/package-surface.md`: package exports and file allowlist
- `contracts/sdk-semver.md`: generated public surface compatibility and version gate

## Migrations

- `migrations/v0.15.3-to-v0.16.0.md`: generated TypeScript client and package migration

상위 실행 기준은 `VALIDATION.md`를 따른다.
