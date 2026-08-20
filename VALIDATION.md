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

- SDK generation source는 `zdp-api-contracts/contracts/sdk-generation-input.yaml`을 유지한다.
- API export dry-run plan은 artifact write나 schema publish를 주장하지 않는다.
- TypeScript, Dart, Rust target은 route metadata와 forbidden value에서 갈라지지 않는다.
- typed fetch operation definition은 API catalog에서 파생하며 product shortcut을 손으로 추가하지 않는다.
- TypeScript schema representation은 operation이 사용하는 schema만 포함한다.
- TypeScript field map은 API required/optional field와 정확히 일치한다.
- checked-in `api-models.ts`는 generator output과 byte 단위로 일치한다.
- domain client는 operation id에서 method tree를 만들고 path/query/body encoding을 metadata에서 파생한다.
- generated request/response type test는 대표 auth, money, abuse operation을 포함한다.
- auth helper는 refresh/session/credential storage를 얻지 않는다.
- package export는 internal-only generator path를 공개하지 않는다.
- release workflow는 `NODE_AUTH_TOKEN`, `NPM_TOKEN`, repository secret을 참조하지 않는다.
- release artifact manifest, tarball, npm `gitHead`, integrity, GitHub Release asset은 같은 version과 commit을 설명한다.
- CI와 release는 `contracts/api-contracts.lock.json`의 exact API revision을 checkout한다.

## Version Impact

`package.json`이 package version source다. `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `BOUNDARY.md`, `RUNBOOK.md`, `service.yaml`, `SECURITY.md`, `LICENSE`, `src/**`, `scripts/**`, `contracts/**` 변경은 version impact review가 필요하다. `CHECKLIST.md`, `VALIDATION.md`, `.agents/**`, `docs/**`는 현재 package allowlist 밖의 source-only guidance다.
