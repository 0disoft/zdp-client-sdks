# zdp-client-sdks

ZDP client SDK 저장소다. 초기 목적은 TypeScript, Dart, Rust SDK가 나중에 같은 API 계약을 소비하도록 생성 입력, 인증 헬퍼, 표준 오류 처리, 업로드 클라이언트 경계를 고정하는 것이다.

## 현재 범위

- SDK generation input handoff 기준
- `zdp-api-contracts/contracts/sdk-generation-input.yaml` 소비 기준
- `zdp-api-contracts` SDK generation input drift 검증
- `zdp-libs-ts` public export handoff 기준
- TypeScript, Dart, Rust SDK surface skeleton
- 인증 토큰 처리 경계
- 표준 error envelope 처리 기준
- signed upload client handoff 기준
- 계약 파일을 읽는 one-shot checker
- SDK generation dry-run plan

## 현재 제외

- 실제 SDK 코드 생성 결과
- SDK 파일 쓰기
- SDK package publish
- live API base URL
- refresh token 보관
- 제품별 business rule
- core, money, privacy 데이터 직접 접근
- API 계약 원천 소유

## 계약

루트 `service.yaml`이 이 저장소의 서비스 계약이다. `contracts/` 아래 파일은 실제 SDK 구현이 생기기 전에 public surface와 금지선을 고정하는 skeleton이다.

## 검증

`contracts:check`는 SDK generation source, libs export source, SDK surface, auth helper, upload client 계약을 읽고 SDK가 다음 경계를 잃지 않았는지 확인한다. `generation:plan`은 같은 계약과 `zdp-api-contracts/contracts/sdk-generation-input.yaml`을 함께 읽고 TypeScript, Dart, Rust SDK를 어떤 입력에서 만들 예정인지 dry-run 계획만 만든다.

- TypeScript, Dart, Rust SDK surface는 같은 API 계약을 소비한다.
- SDK generation source는 `zdp-api-contracts/contracts/sdk-generation-input.yaml`만 입력 원천으로 쓴다.
- API SDK generation input drift 검증은 `zdp-api-contracts`와 `zdp-client-sdks`가 generation target, route metadata, error metadata, webhook metadata를 다르게 주장하는 일을 막는다.
- libs export source는 `zdp-libs-ts/schema`, `zdp-libs-ts/env-contract`, `zdp-libs-ts/event-contracts`, `zdp-libs-ts/error`, `zdp-libs-ts/i18n-contract`만 공통 계약 입력으로 참조한다.
- route metadata의 `idempotency`는 같은 요청이 두 번 들어와도 SDK가 재시도 안전성을 잃지 않게 해준다.
- error metadata의 `request_id`, `trace_id`는 사용자가 겪은 실패를 서버 로그와 연결할 수 있게 해준다.
- libs metadata의 `schema_id`, `error_code`, `message_key`, `request_id`, `trace_id`는 SDK 생성기가 스키마 이름, 에러 코드, 번역 키, 추적 식별자를 언어별로 따로 지어내지 않게 해준다.
- webhook metadata의 `idempotency_key`, `replay_policy`, `dead_letter_policy`는 중복 이벤트와 실패 이벤트를 SDK 표면에서 숨기지 않게 해준다.
- SDK는 `request_id` 전파, 표준 error envelope, pagination, upload handoff 기준을 유지한다.
- SDK는 API contract source가 아니다.
- auth helper는 access token 부착 경계만 소유하고 refresh token storage, membership authority, entitlement authority를 소유하지 않는다.
- upload client는 signed upload request shape과 error mapping을 소유하지만 bucket name, raw provider URL, file ownership decision을 공개 계약으로 만들지 않는다.

이렇게 해두면 SDK가 클라이언트 편의 코드라는 이유로 API 원천, libs package 원천, refresh token 저장소, 권한 최종 판단자, provider URL 공개 계약으로 커지는 일을 checker 단계에서 먼저 막을 수 있다. 또한 raw customer payload, provider secret, provider token, authorization header 같은 값이 SDK 생성 입력으로 섞이는 것을 금지해서, SDK 패키지가 민감한 운영 데이터를 예시나 타입으로 굳히는 사고를 줄인다. dry-run generation plan은 실제 파일을 만들지 않고도 이 입력 조합을 반복 검증하게 해준다. 즉 SDK 생성기가 붙기 전부터 "어느 언어가 어느 API 계약과 어느 공통 libs export를 소비하는지"가 고정되고, 실수로 한 언어만 다른 원천을 바라보는 일을 줄인다. API input drift 검증은 `trace_id` 같은 필드가 API 계약에는 있는데 SDK plan에는 없는 상태를 막아, 장애 문의 때 SDK 오류와 서버 로그를 연결할 실마리가 사라지는 일을 줄인다.

```bash
bun run check
bun run contracts:check
bun run generation:plan -- --check
bun run generation:plan -- --json
bun scripts/plan-sdk-generation.ts --api-contracts-root ../zdp-api-contracts --json
```

아키텍처 검증은 `zdp-architecture-linter`에서 이 저장소를 대상으로 실행한다.

```bash
bun src/cli.ts validate --architecture ..\..\docs\zdp-architecture --repository ..\..\contracts\zdp-client-sdks --json
```
