# VALIDATION.md

이 문서는 `zdp-client-sdks` 변경 후 확인할 기준을 모은다. 실행 권한은 mustflow command contract가 소유한다.

## Configured Validation

| 변경 범위 | 확인 기준 |
| --- | --- |
| SDK surface, typed fetch, auth helper, upload client, generation plan | `zdp_client_sdks_check` |
| npm package contents or release readiness | `zdp_client_sdks_npm_pack_dry_run` |
| repository architecture contract | `zdp_architecture_validate_client_sdks_repository` |
| architecture catalog or linter rule changes | `zdp_architecture_validate_fast` |
| agent docs only | `docs_validate_fast` |

`zdp_client_sdks_install_frozen`은 dependencies가 없거나 package metadata 변경으로 install evidence가 필요할 때만 쓴다. Publish dry-run과 public publish는 명시적 release approval과 token/network gate가 필요하다.

## Source Of Truth Checks

- service boundary: `service.yaml`
- package boundary: `package.json`, `BOUNDARY.md`, `SECURITY.md`
- SDK surface contract: `contracts/sdk-surface.yaml`
- generation source: `contracts/sdk-generation-source.yaml`
- libs handoff: `contracts/libs-export-source.yaml`
- auth helper: `contracts/auth-helper.yaml`
- upload client: `contracts/upload-client.yaml`
- checkers: `scripts/check-client-sdk-contracts.ts`, `scripts/plan-sdk-generation.ts`
- typed fetch runtime: `src/typed-fetch/**`
- generation plan code: `src/sdk-generation-plan/**`

## Drift Checks

- SDK generation source must still point to `zdp-api-contracts/contracts/sdk-generation-input.yaml`.
- API export dry-run plan handoff must not claim artifact writes or schema publishing.
- TypeScript, Dart, and Rust targets must not diverge on route metadata or forbidden sensitive values.
- Typed fetch operation definitions must stay derived from API catalog data, not hand-authored product shortcuts.
- Schema model metadata must preserve both required and optional fields from the API export plan.
- Auth helper must not gain refresh/session/credential storage.
- Package exports must not expose generated artifacts or internal implementation-only paths.

## Version Impact

`package.json` is the package version source. `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `BOUNDARY.md`, `RUNBOOK.md`, `service.yaml`, `SECURITY.md`, `LICENSE`, `src/**`, and `contracts/**` are in the package file allowlist. Changes there require package version impact review. `CHECKLIST.md`, `VALIDATION.md`, `.agents/**`, and `docs/**` are source-only agent guidance under the current allowlist.
