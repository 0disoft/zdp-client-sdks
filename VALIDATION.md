# VALIDATION.md

이 문서는 `zdp-client-sdks` 변경 후 확인할 기준을 모은다. 관련 package scripts와 저장소 명령을 직접 실행한다.

## Direct Validation Commands

| 변경 범위 | 확인 기준 |
| --- | --- |
| TypeScript models, domain client, typed fetch, auth helper, upload client, generation plan | `bun run check` |
| npm package contents or release readiness | `npm.cmd pack --dry-run --json` |
| tokenless npm publish metadata dry-run | `bun scripts/publish-dry-run.ts` |
| repository architecture contract | `bun src/cli.ts validate --architecture ../../docs/zdp-architecture --repository ../../contracts/zdp-client-sdks` (cwd: `projects/zdp-platforms/architecture-tools/zdp-architecture-linter`) |
| architecture catalog or linter rule changes | `bun run validate:architecture` (cwd: `projects/zdp-platforms/architecture-tools/zdp-architecture-linter`) |
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
- private coupon capture transport: `../zdp-api-contracts/contracts/apis/money-api/coupon-usage-capture.schema.json`, `src/server-coupon-usage/**`, `scripts/sync-server-coupon-usage.ts`

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
- Server coupon capture models must match the private API schema; the server subpath must remain separate from root/browser clients.
- Capture sends only saved operation/hold references. Exact credit strings, correlation headers, receipt ownership and amount invariants must be checked before reporting capture success.
- A submitted timeout, cancellation or invalid response remains unknown; the SDK must not create a hold, retry automatically or deliver product results.
- Package exports must expose only compiled `dist/**/*.js` runtime files and matching `dist/**/*.d.ts` declarations.
- Package files must exclude `src/`, tests, checker implementations, and internal generation-plan implementations.
- Emitted ESM and declarations must use explicit runtime file extensions so Node `NodeNext` resolution does not depend on bundler-only behavior.
- Packed consumers must pass Node and Bun direct imports plus TypeScript `NodeNext`; CI additionally checks the current Vite major.
- Release workflow must not reference `NODE_AUTH_TOKEN`, `NPM_TOKEN`, or repository secrets.
- Release artifact manifest, packed tarball, npm `gitHead`, npm integrity, and GitHub Release assets must describe the same version and commit.
- CI and release workflows must checkout the exact API contract revision in `contracts/api-contracts.lock.json`; latest API compatibility is a separate lock-update check, not an implicit release input.

## Version Impact

`package.json` is the package version source. `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `BOUNDARY.md`, `RUNBOOK.md`, `service.yaml`, `SECURITY.md`, `LICENSE`, `contracts/**`, and `src/typed-fetch/**` and `src/upload/**` affect the published package and require version impact review. `dist/**` is generated from reviewed runtime source and must not be committed. `src/client-sdk-contracts/**`, `src/sdk-generation-plan/**`, `scripts/**`, `CHECKLIST.md`, `VALIDATION.md`, `.agents/**`, and `docs/**` are source-only implementation or guidance, but package build and release changes still require packed consumer evidence.

`src/server-coupon-usage/**`는 발행 package의 별도 서버 전용 surface다. 새 subpath 추가는 additive 변경이므로 다음 발행에서 minor 버전 검토가 필요하다. 이번 작업에서는 버전을 자동으로 올리거나 발행하지 않는다.

## 쿠폰 서버 연결 검증 기록 (2026-10-05)

- `bun run check`: TypeScript 검사, 전체 테스트 150개, 계약·원천 SHA·생성 모델 drift·SemVer·generation plan·release artifact 검증이 통과했다.
- `bun test tests/server-coupon-usage.test.ts`: 10개 통과. 실제 loopback HTTP, 큰 금액 문자열, 확정·거절·미확정·전송 전 실패, timeout·abort·본문 제한과 늦은 응답 정리를 검증했다.
- `bun scripts/smoke-packed-package.ts`: Node·Bun의 설치된 package capture 호출과 TypeScript NodeNext 선언 해석이 통과했다.
- npm 12.0.2에서 기존 release artifact 검증은 pack JSON을 배열로 가정해 실패했다. 배열·package map을 모두 검증하도록 수정한 뒤 `bun test tests/npm-pack-result.test.ts` 2개와 `bun scripts/build-release-artifact.ts --check`가 통과했다.
- API 계약 원천은 `114c16a7a1a4ce79ef91ca527c4f2724a556acfb`이며 CI·release checkout과 lock을 맞췄다. 원격 반영 시 이 계약 commit이 먼저 필요하다.
- 실제 Money 스테이징, Core 서비스 grant, DB migration·grant 적용, 제품의 영속 예약·결과 제공은 이번 package 검증에서 실행하지 않았다. 적용 제품과 요금은 나중에 결정한다.
