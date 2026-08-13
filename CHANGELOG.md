# CHANGELOG.md

## 0.15.3

### Fixed

- SDK generation plan이 sibling 저장소의 TypeScript 모듈을 import해 실행하지 않고 잠긴 YAML 계약만 수동 파싱하도록 바꿨다.
- typed fetch operation metadata를 API route catalog 자체에서 구성해 method, path, auth, idempotency, request/trace 요구사항, schema, status와 error code가 별도 handoff에서 이탈할 여지를 제거했다.
- npm Trusted Publisher OIDC 권한을 검증된 artifact만 받는 최소 publish job으로 격리하고, checkout·dependency·build·smoke·사후 검증은 별도 job으로 분리했다.

## 0.15.2

### Fixed

- typed fetch operation 경로를 query·fragment 없는 동일 origin의 root-relative 경로로 제한해 bearer token이 외부 origin으로 전달되지 않게 했다.
- generated request schema의 비밀 필드는 URL query나 path parameter로 인코딩할 수 없도록 fail-closed 검증을 추가했다.

## 0.15.1

### Changed

- `zdp-api-contracts@0.29.2`의 정확한 Git revision으로 API 입력 잠금과
  CI·Trusted Publisher checkout을 갱신했다.
- password registration schema가 client-selected `terms_consent_ref` 대신
  Core 발급 `policy_set_resolution_ref`를 요구하도록 generated metadata를 동기화했다.

## 0.15.0

### Changed

- `zdp-api-contracts@0.23.0`의 정확한 Git revision으로 API 입력 잠금과 CI·Trusted Publisher checkout을 갱신했다.
- credit checkout status와 return receipt exchange schema model에 분리된 `return_receipt_status`를 반영하고, status 조회의 선택적 `payment_attempt_ref`·`ledger_issuance_ref`를 보존한다.
- provider 결제 성공과 ledger 지급 완료를 별개로 다루는 Money 계약을 generated typed fetch metadata에 동기화했다.

## 0.14.0

### Added

- credit pack catalog 조회, checkout intent 생성·상태 조회, 일회용 return receipt 교환 operation을 generated typed fetch 공개 표면에 추가했다.
- API export plan에서 schema model과 operation metadata를 결정적으로 동기화하는 `api-operations:sync` 경로를 추가했다.

### Changed

- `zdp-api-contracts@0.22.0`의 정확한 Git revision으로 API 입력을 갱신하고 access decision, OIDC, sensitive-action authorization, credit purchase 계약을 generation plan에 포함했다.
- CI와 Trusted Publisher release가 동일한 API revision을 checkout하고, 체크인 operation metadata가 export plan과 일치하는지 기본 검사에서 확인하도록 강화했다.

## 0.13.1

### Added

- npm Trusted Publisher를 사용하는 태그 기반 공개 릴리스 workflow를 추가했다.
- 공개 패키지가 소비한 `zdp-api-contracts` revision을 full Git SHA로 잠그는 계약을 추가했다.
- 공개할 정확한 tarball을 packed consumer로 검증하고 npm `gitHead`, integrity, provenance, registry signature, published consumer를 확인하는 릴리스 검사를 추가했다.
- 같은 tarball, release manifest, release notes를 GitHub Release 자산으로 보존하고 재실행 시 상태와 바이트 일치를 확인하도록 했다.

### Changed

- 로컬 장기 npm token 공개 경로를 릴리스 계약에서 제거하고, 공개 작업은 GitHub Actions OIDC 경로만 허용하도록 명시했다.
- 릴리스 도구 체인을 Node 24.18.0, npm 11.16.0, Bun 1.3.14로 고정하고 registry 오류는 명시적 `E404`만 미공개 버전으로 인정하도록 fail-closed 처리했다.
- npm 공개 전후 장애를 버전 재사용이나 tag 이동 없이 복구하는 절차를 RUNBOOK에 추가했다.

## 0.13.0

### Changed

- generated typed fetch의 HTTP 204 success response 타입을 `undefined`로 명시해 body schema와 충돌하지 않게 했다.
- SDK surface의 `pagination handling`이 현재 단계에서는 metadata handoff를 뜻하며 자동 페이지 순회는 포함하지 않는다고 문서에 명확히 했다.

### Fixed

- `core.auth.sessions.revoke_current`의 정상적인 빈 204 응답이 response schema required field 오류로 바뀌던 문제를 고쳤다.
- 빈 error body와 non-JSON error body의 protocol error 동작을 회귀 테스트로 고정했다.

## 0.12.0

### Added

- current-session 조회와 desktop product-link create·complete·exchange operation을 API export plan에서 가져온 checked-in typed fetch map에 추가했다.
- generated schema model에 `optionalFields`를 추가하고 product-link exchange의 선택적 `workspace_ref`를 TypeScript payload type에 보존했다.

### Changed

- SDK generation plan이 auth-session consumer와 product-link 계약을 필수 API 입력으로 검증한다.
- auth helper가 product-link proof verifier를 저장소 책임으로 가져가지 못하도록 계약 검증을 강화했다.

## 0.11.1

### Changed

- public npm package surface에 `SECURITY.md`를 포함해 SDK 계약 저장소의 토큰, 세션, provider credential 금지 경계를 명시했다.

## 0.11.0

### Changed

- API export plan의 `schemaModelMap`을 SDK schema model handoff의 우선 입력으로 사용하도록 바꿨다.
- generated typed fetch operation request/response 타입을 schema model metadata에 연결했다.
- generated typed fetch runtime이 request required field와 response required field 누락을 실패로 잡도록 강화했다.

## 0.10.0

### Added

- `zdp-api-contracts` schema bundle을 읽는 schema model handoff reader를 추가했다.
- generated TypeScript typed fetch surface에 API schema model metadata와 drift 검증을 추가했다.
- SDK generation plan이 operation request/response schema refs와 schema model map 정합성을 검증하도록 강화했다.

## 0.9.0

### Added

- `zdp-api-contracts` typed fetch operation map을 checked-in TypeScript operation definitions로 노출하고 `createZdpApiClient()`로 minimal typed fetch runtime에 연결했다.
- generated operation definitions가 API export plan handoff와 drift 나면 실패하는 테스트를 추가했다.

## 0.8.0

### Changed

- SDK generation plan이 API export dry-run plan의 `typedFetchOperationMap`을 읽고 route catalog operation id와 method/path/status/auth/idempotency/schema/error metadata drift를 검증하도록 강화했다.
- TypeScript typed fetch runtime foundation과 API export operation map handoff를 연결했다.

## 0.6.3

### Changed

- SDK generation plan이 API forbidden ownership, API export plan forbidden values, unhandled API source contract, unhandled API export output kind drift를 실패로 잡도록 강화했다.
- SDK generation source가 API route/webhook export forbidden values와 SDK runtime implementation 금지 경계를 반영하도록 맞췄다.

## 0.6.2

### Changed

- `check:tsgo` fast typecheck 스크립트와 pinned `@typescript/native-preview` 의존성을 추가했다.
- SDK generation source를 `zdp-api-contracts`의 auth/session route metadata와 맞춰 owner, tenant, request, trace, session, credential policy metadata를 요구하도록 강화했다.
- SDK surface, auth helper, upload client가 request/trace/idempotency propagation과 raw credential/session token 금지 경계를 잃으면 실패하도록 강화했다.
- API input forbidden values가 `refresh_token_plaintext`와 `stack_trace` 같은 필수 금지값을 잃거나 SDK generation source로 전달되지 않으면 잡도록 했다.

## 0.6.0

### Changed

- API export plan handoff 검증을 TypeScript source text 검색이 아니라 실제 `buildApiExportPlan()` 결과를 읽는 방식으로 바꿨다.
- SDK/API route handoff metadata에 `success_statuses`를 추가했다.
- contract status 검증을 `skeleton` 고정값에서 `skeleton`/`draft`/`reviewed` pre-release 생명주기 allowlist로 완화했다.
- YAML 파싱을 Bun 내장 `Bun.YAML.parse`로 통일하고 외부 `yaml` 의존성을 제거했다.
- client SDK contract와 API input 로딩을 비동기 I/O로 통일했다.

## 0.5.1

### Changed

- SDK generation plan이 `zdp-api-contracts`의 API export dry-run plan handoff까지 검증하도록 했다.
- API export plan의 `sdk_generation_input`, `openapi`, `docs_contract`, `webhook_schema`, `request_id`, `trace_id`, dry-run 보장이 깨지면 SDK 생성 계획도 실패하도록 했다.

## 0.5.0

### Added

- Client SDK 저장소 골격을 추가했다.
- SDK surface, auth helper, upload client contract skeleton을 추가했다.
- SDK surface, auth helper, upload client 계약을 읽는 repo-local checker skeleton을 추가했다.
- SDK generation source handoff 계약과 checker 검증을 추가했다.
- `zdp-libs-ts` public export source handoff 계약과 checker 검증을 추가했다.
- SDK generation dry-run plan skeleton과 `generation:plan` 검증을 추가했다.
- `generation:plan`이 `zdp-api-contracts/contracts/sdk-generation-input.yaml`을 읽고 client SDK generation source와 drift를 비교하도록 했다.
