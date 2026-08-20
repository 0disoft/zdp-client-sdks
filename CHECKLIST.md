# CHECKLIST.md

이 저장소는 `zdp-api-contracts`를 소비하는 TypeScript SDK runtime과 cross-language generation plan을 소유한다. 작업 전 변경 대상이 TypeScript model generation, domain client, typed fetch runtime, auth helper, upload client, package surface, API/libs handoff 중 어디인지 먼저 고른다.

## 공통 경계

- API route, required/optional field, error, webhook, SDK generation input 원천은 `zdp-api-contracts`다.
- `contracts/typescript-sdk-models.yaml`은 TypeScript representation만 선언하며 API field를 추가하거나 제거하지 않는다.
- `zdp-libs-ts` public export는 소비 입력이며 이 저장소가 libs package 원천이 되면 안 된다.
- SDK는 refresh token storage, session token storage, raw credential storage, final authorization, membership, entitlement, product business rule을 소유하지 않는다.
- 실제 token, Authorization header, signed upload URL, provider secret, provider raw response, customer payload를 source, contracts, tests, docs에 넣지 않는다.

## TypeScript Model Generation

- operation이 사용하는 request/response schema를 모두 포함한다.
- field map은 API required/optional field 집합과 정확히 일치한다.
- 사용하지 않는 schema representation을 남기지 않는다.
- generated model file을 직접 수정하지 않는다.
- datetime, locale, currency, decimal의 wire string 표현을 바꾸지 않는다.
- enum은 API 계약에 명시된 안정 값만 좁힌다.

## TypeScript Client

- operation id namespace와 method 이름은 결정적으로 생성한다.
- path field는 URL path로 이동하고 GET의 나머지 field만 query에 넣는다.
- mutation payload는 path field를 제외한 JSON body로 만든다.
- request unknown field와 field type mismatch는 fetch 전에 실패한다.
- response required field와 type mismatch는 protocol error로 실패한다.
- low-level `raw.call()`과 generic `call()` 탈출구를 유지한다.

## SDK Generation

- Generation source는 `contracts/sdk-generation-source.yaml`에서 `zdp-api-contracts/contracts/sdk-generation-input.yaml`을 가리킨다.
- `generation:plan`은 cross-language dry-run plan만 만들고 SDK, OpenAPI, schema, docs, webhook artifact를 쓰거나 publish하지 않는다.
- TypeScript, Dart, Rust targets는 같은 API source, route metadata, success status, error metadata, webhook replay metadata, forbidden value set을 공유한다.

## Typed Fetch And Auth

- operation id, request id, trace id, timeout, abort signal, idempotency key, standard error envelope를 보존한다.
- HTTP 204는 `undefined`로 디코딩한다.
- secret field를 query나 path로 보내지 않는다.
- access token은 인증 operation에만 부착한다.
- credential, refresh, session lifecycle은 consuming app이나 core/auth boundary가 소유한다.

## Package Surface

- Public exports는 package root, `./typed-fetch`, `./typed-fetch/api-operations`다.
- `files` whitelist는 `src/`, `contracts/`, 운영 문서, `LICENSE`만 포함한다.
- generated TypeScript source는 package에 포함하고 Dart/Rust runtime artifact는 포함하지 않는다.
- Package publish 전 check와 npm pack dry-run evidence가 필요하다.
- `contracts/api-contracts.lock.json`, CI checkout, release checkout은 동일한 full API contract Git SHA를 가리킨다.
- 공개 릴리스는 exact version tag와 npm Trusted Publisher OIDC만 사용한다.
- 로컬 npm token publish, 공개 version 재사용, tag 이동은 허용하지 않는다.
