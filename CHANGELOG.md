# CHANGELOG.md

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
