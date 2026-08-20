# VALIDATION.md

이 문서는 `zdp-client-sdks` 변경 후 확인할 기준을 모은다. 실행 권한은 mustflow command contract가 소유한다.

## Configured Validation

| 변경 범위 | 확인 기준 |
| --- | --- |
| TypeScript models, domain client, typed fetch, auth helper, upload client, generation plan | `zdp_client_sdks_check` |
| npm package contents or release readiness | `zdp_client_sdks_npm_pack_dry_run` |
| tokenless npm publish metadata dry-run | `zdp_client_sdks_npm_publish_dry_run` |
| repository architecture contract | `zdp_architecture_validate_client_sdks_repository` |
| architecture catalog or linter rule changes | `zdp_architecture_validate_fast` |
| agent docs only | `docs_validate_fast` |

`zdp_client_sdks_install_frozen`은 dependency나 package metadata 변경으로 install evidence가 필요할 때만 쓴다. 실제 public publish는 승인된 exact version tag가 시작하는 GitHub Actions Trusted Publisher workflow만 사용한다.

## Source Of Truth Checks

- service boundary: `service.yaml`
- package boundary: `package.json`, `BOUNDARY.md`, `SECURITY.md`
- compiled package build: `tsconfig.build.json`, `scripts/build-package.ts`
- packed consumer smoke: `scripts/smoke-packed-package.ts`
- SDK surface contract: `contracts/sdk-surface.yaml`
- TypeScript representation contract: `contracts/typescript-sdk-models.yaml`
- generation source: `contracts/sdk-generation-source.yaml`
- libs handoff: `contracts/libs-export-source.yaml`
- auth helper: `contracts/auth-helper.yaml`
- upload client: `contracts/upload-client.yaml`
- model generator: `scripts/sync-typescript-api-models.ts`
- operation generator: `scripts/sync-api-operations.ts`
- typed fetch runtime and domain client: `src/typed-fetch/**`
- generation plan code: `src/sdk-generation-plan/**`

## Drift Checks

- SDK generation source must still point to `zdp-api-contracts/contracts/sdk-generation-input.yaml`.
- API export dry-run plan handoff must not claim artifact writes or schema publishing.
- TypeScript, Dart, and Rust targets must not diverge on route metadata or forbidden sensitive values.
- Typed fetch operation definitions must stay derived from API catalog data, not hand-authored product shortcuts.
- Schema model metadata must preserve both required and optional fields from the API export plan.
- TypeScript field map must exactly cover API required and optional fields.
- Checked-in model source must match generator output byte-for-byte.
- Domain client methods and path/query/body encoding must remain derived from operation metadata.
- Auth helper must not gain refresh/session/credential storage.
- Package exports must expose only compiled `dist/**/*.js` runtime files and matching `dist/**/*.d.ts` declarations.
- Package files must exclude `src/`, tests, checker implementations, and internal generation-plan implementations.
- Emitted ESM and declarations must use explicit runtime file extensions so Node `NodeNext` resolution does not depend on bundler-only behavior.
- Packed consumers must pass Node and Bun direct imports plus TypeScript `NodeNext`; CI additionally checks the current Vite major.
- Release workflow must not reference `NODE_AUTH_TOKEN`, `NPM_TOKEN`, or repository secrets.
- Release artifact manifest, packed tarball, npm `gitHead`, npm integrity, and GitHub Release assets must describe the same version and commit.
- CI and release workflows must checkout the exact API contract revision in `contracts/api-contracts.lock.json`; latest API compatibility is a separate lock-update check, not an implicit release input.

## Version Impact

`package.json` is the package version source. `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `BOUNDARY.md`, `RUNBOOK.md`, `service.yaml`, `SECURITY.md`, `LICENSE`, `contracts/**`, and `src/typed-fetch/**` and `src/upload/**` affect the published package and require version impact review. `dist/**` is generated from reviewed runtime source and must not be committed. `src/client-sdk-contracts/**`, `src/sdk-generation-plan/**`, `scripts/**`, `CHECKLIST.md`, `VALIDATION.md`, `.agents/**`, and `docs/**` are source-only implementation or guidance, but package build and release changes still require packed consumer evidence.
