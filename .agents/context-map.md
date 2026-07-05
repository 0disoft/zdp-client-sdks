# Context Map

| Work type | Read first | Validate with |
| --- | --- | --- |
| SDK generation handoff | `contracts/sdk-generation-source.yaml`, `src/sdk-generation-plan/**`, `scripts/plan-sdk-generation.ts` | `zdp_client_sdks_check` |
| API input drift | `../zdp-api-contracts/contracts/sdk-generation-input.yaml`, `contracts/sdk-generation-source.yaml` | `zdp_client_sdks_check` |
| Typed fetch runtime | `src/typed-fetch/**`, `contracts/sdk-surface.yaml` | `zdp_client_sdks_check` |
| Auth helper | `contracts/auth-helper.yaml`, `SECURITY.md`, typed fetch auth code | `zdp_client_sdks_check` |
| Upload client | `contracts/upload-client.yaml`, `SECURITY.md` | `zdp_client_sdks_check` |
| Package surface | `package.json`, `src/index.ts`, `src/typed-fetch/index.ts` | `zdp_client_sdks_check`, `zdp_client_sdks_npm_pack_dry_run` when package surface changes |
| Agent docs only | `CHECKLIST.md`, `VALIDATION.md`, `.agents/**`, `docs/**` | `docs_validate_fast` |
