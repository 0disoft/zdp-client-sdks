# CHECKLIST.md

이 저장소는 `zdp-api-contracts`를 소비하는 SDK surface와 generation dry-run 계약을 소유한다. 작업 전 변경 대상이 SDK generation source, typed fetch runtime, auth helper, upload client, package surface, API/libs handoff 중 어디인지 먼저 고른다.

## 공통 경계

- API 계약 원천은 `zdp-api-contracts`다. 이 저장소가 route, error, webhook, SDK generation input의 source of truth가 되면 안 된다.
- `zdp-libs-ts` public export는 소비 입력이며, 이 저장소가 libs package 원천이 되면 안 된다.
- SDK는 refresh token storage, session token storage, raw credential storage, final authorization, membership, entitlement, product business rule을 소유하지 않는다.
- 실제 token, Authorization header, signed upload URL, provider secret, provider raw response, customer payload를 source, contracts, tests, docs에 넣지 않는다.

## SDK Generation

- Generation source는 `contracts/sdk-generation-source.yaml`에서 `zdp-api-contracts/contracts/sdk-generation-input.yaml`을 가리켜야 한다.
- `generation:plan`은 dry-run plan만 만든다. SDK 파일, OpenAPI, schema, docs, webhook artifact를 쓰거나 publish하면 안 된다.
- TypeScript, Dart, Rust targets는 같은 API source, route metadata, success status, error metadata, webhook replay metadata, forbidden value set을 공유해야 한다.
- API export plan handoff는 actual plan result를 읽어 `openapi`, `sdk_generation_input`, `webhook_schema`, `docs_contract` output kind를 확인해야 한다.

## Typed Fetch And Auth

- Typed fetch는 operation id, request id, trace id, timeout, abort signal, idempotency key, pagination metadata, standard error envelope를 보존한다.
- HTTP 204 success는 body schema required field를 가장하지 않고 `undefined`로 디코딩한다.
- Generated schema model은 required field와 optional field를 구분하고 API handoff에서 빠뜨리지 않는다.
- Auth helper는 access token attachment boundary만 소유한다.
- Credential, refresh, session lifecycle은 consuming app이나 core/auth boundary가 소유한다.
- Auth/session route metadata를 일반 CRUD처럼 취급하지 않는다.

## Upload Client

- Signed upload authorization, provider transfer, completion은 하나의 timeout·cancellation signal과 request/trace/idempotency context를 공유한다.
- 로컬 파일 제한과 authorization 범위의 크기·MIME 제한을 provider 전송 전에 모두 적용한다.
- SHA-256 checksum을 authorization과 completion에 전달한다.
- Provider 전송 재시도는 `replaySafe: true`일 때만 허용하고 최대 시도 횟수를 제한한다.
- Provider 요청에는 ZDP Authorization, cookie, request ID, trace ID, idempotency key를 붙이지 않는다.
- Bucket name, raw provider URL, signed URL persistence, provider response body, file ownership decision을 public SDK contract로 만들지 않는다.

## Package Surface

- Public exports는 package root, `./typed-fetch`, `./typed-fetch/api-operations`, `./upload`이다.
- `files` whitelist는 `src/`, `contracts/`, 운영 문서, `LICENSE`만 포함한다.
- Generated language-specific SDK runtime artifact는 package에 포함하지 않는다.
- Package publish 전에는 check와 npm pack dry-run evidence가 필요하다.
- 공개 릴리스는 `package.json` 버전과 같은 `v<version>` 태그, `main` 포함 관계, npm Trusted Publisher의 OIDC 권한을 모두 요구한다.
- publish 대상 tarball은 packed consumer가 검증한 동일 파일이어야 하며 npm `gitHead`와 integrity가 tag SHA와 release manifest에 일치해야 한다.
- 공개 후에는 빈 registry consumer, `npm audit signatures`, SLSA provenance, GitHub Release 자산 일치를 확인한다.
- `contracts/api-contracts.lock.json`, CI checkout, release checkout은 동일한 full API contract Git SHA를 가리킨다.
- 로컬 npm token publish, 이미 공개된 버전 재사용, tag 이동은 허용하지 않는다.
