# zdp-client-sdks

ZDP API 계약을 실제 제품 코드에서 바로 사용할 수 있는 TypeScript SDK로 변환하는 저장소다. TypeScript 구현을 먼저 운영 가능한 수준으로 고정하고, Dart와 Rust는 같은 API 입력을 소비하는 생성 계획을 유지한다.

## 현재 범위

- `zdp-api-contracts/contracts/sdk-generation-input.yaml` 소비와 drift 검증
- `zdp-libs-ts` public export handoff 검증
- TypeScript, Dart, Rust SDK surface와 공통 생성 계획
- generated TypeScript request/response 모델
- generated schema required/optional field와 TypeScript field representation 계약
- API operation id 기반 TypeScript domain method tree
- path parameter, GET query, mutation JSON body 자동 인코딩
- request/response runtime field type 검증
- typed fetch timeout, abort signal, request id, trace id, idempotency key 처리
- access token attachment와 표준 error envelope 정규화
- current-session, product-link, credit purchase, referral, abuse challenge operation
- signed upload authorization, provider transfer, completion TypeScript runtime
- upload file size·MIME 제한, SHA-256 checksum, 진행률, 취소, replay-safe 제한적 재시도
- compiled ESM runtime과 TypeScript declaration package output
- Node, Bun, TypeScript NodeNext packed consumer smoke와 Vite current-major CI smoke
- npm Trusted Publisher, immutable release artifact, packed/published consumer smoke
- SDK generation dry-run plan과 checked-in generated source drift 검증

## 현재 제외

- Dart와 Rust generated runtime 및 package publishing
- API 계약에 선언되지 않은 제품별 convenience model
- 중첩 object 내부까지 추론하는 독립 schema language
- 자동 페이지 순회
- multipart·resumable upload orchestration
- live API base URL
- refresh token, session token, raw credential 보관
- 제품별 business rule과 최종 권한 판단
- core, money, privacy 데이터 직접 접근
- API 계약 원천 소유

## TypeScript 사용법

`createZdpClient()`는 operation id를 camelCase namespace로 변환한다. 호출자는 더 이상 `pathParams`, `query`, `body`를 직접 조립하지 않는다. payload field는 API wire contract와 동일한 snake_case를 유지한다.

```ts
import { createZdpClient } from 'zdp-client-sdks';

const client = createZdpClient({
  baseUrl: 'https://api.example.test',
  getAccessToken: () => readCurrentAccessToken(),
  requestIdFactory: () => crypto.randomUUID(),
  traceIdFactory: () => crypto.randomUUID()
});

const session = await client.core.auth.sessions.create(
  {
    login_identifier: loginIdentifier,
    verifier
  },
  {
    idempotencyKey: crypto.randomUUID()
  }
);

const catalog = await client.money.creditPackCatalogProjections.get({
  product_ref: productRef,
  scope_type: 'account',
  scope_ref: accountRef,
  environment: 'production',
  locale: 'ko-KR'
});
```

필요하면 low-level typed fetch surface도 그대로 사용할 수 있다.

```ts
const client = createZdpClient(options);

await client.call('core.auth.sessions.get_current');
await client.raw.call('core.auth.sessions.get_current', {});
```

## TypeScript 모델 생성

`contracts/typescript-sdk-models.yaml`은 API schema field를 TypeScript에서 어떤 표현으로 노출할지만 선언한다. required/optional field 집합과 operation별 request/response schema 선택은 계속 `zdp-api-contracts`가 소유한다.

생성기는 다음 drift를 모두 실패로 처리한다.

- operation이 사용하는 schema representation 누락
- 사용되지 않는 schema representation 잔존
- API required/optional field와 TypeScript field map 불일치
- 중복 schema id 또는 TypeScript identifier로 만들 수 없는 schema id
- 지원하지 않는 field descriptor와 중복 enum 값
- checked-in `src/typed-fetch/api-models.ts`와 생성 결과 불일치

지원 representation은 string, boolean, integer, datetime, locale, uri, currency, decimal, JSON value, JSON object, string array, JSON object array, string enum이다. datetime, locale, currency, decimal은 wire format을 보존하는 semantic string alias다.

```bash
bun run typescript-models:sync
bun run typescript-models:check
```

## 계약

루트 `service.yaml`이 저장소의 운영 계약이다. `zdp-api-contracts`는 route, schema field presence, success status, error code, auth, idempotency와 request/trace 요구사항의 원천이다. 이 저장소는 그 입력을 잠긴 Git revision에서 읽어 TypeScript representation과 실행 surface를 생성한다.

공개 패키지는 표준 ESM runtime과 TypeScript 소비자를 위한 compiled package다. public export는 package root, `zdp-client-sdks/typed-fetch`, `zdp-client-sdks/typed-fetch/api-operations`, `zdp-client-sdks/upload`다. runtime export는 `dist/**/*.js`, type export는 대응하는 `dist/**/*.d.ts`를 가리키며 `src/`, checker, generation-plan 구현, tests는 tarball에 포함하지 않는다. generated TypeScript models, client facade, signed upload runtime은 compiled output에 포함하고 Dart와 Rust runtime artifact는 제외한다.

공개 릴리스는 `package.json` 버전과 같은 `v<version>` tag가 `main`에 포함된 commit을 가리킬 때만 실행된다. GitHub Actions의 npm Trusted Publisher가 OIDC로 검증된 tarball을 공개하며 장기 npm token이나 로컬 `npm publish`는 사용하지 않는다. 같은 tarball은 Node·Bun direct import, TypeScript `NodeNext`, Vite current-major 소비를 통과해야 하며, 공개 후 npm `gitHead`, integrity, registry signature, SLSA provenance, GitHub Release asset을 같은 commit과 대조한다.

`contracts/api-contracts.lock.json`은 generated operation map과 TypeScript model generation이 소비한 `zdp-api-contracts` full Git SHA를 고정한다. 일반 CI와 release workflow는 같은 revision을 checkout한다. 최신 API main 호환성은 lock 갱신과 generated source 동기화를 포함한 별도 변경으로 처리한다.

## 안전 경계

- SDK는 API contract source가 아니다.
- secret field는 URL query와 path에 넣지 않는다.
- access token은 인증이 필요한 operation에만 호출 시점에 부착한다.
- refresh token, session token, product-link proof verifier를 저장하지 않는다.
- provider secret, raw provider response, customer payload를 모델 fixture나 오류에 넣지 않는다.
- HTTP 204는 `undefined`로 반환한다.
- request와 response field type drift는 fetch 전후에 각각 configuration error와 protocol error로 실패시킨다.
- 최종 authorization, membership, entitlement와 money mutation authority는 서버 경계가 소유한다.

## Signed upload runtime

`zdp-client-sdks/upload`은 authorization adapter가 반환한 ephemeral `Request` factory를 사용해 `authorize → provider transfer → complete`를 실행한다. signed URL은 factory closure 안에만 존재하며 upload 결과와 오류에는 들어가지 않는다.

```ts
import { createZdpSignedUploadClient } from 'zdp-client-sdks/upload';

const uploads = createZdpSignedUploadClient({
  limits: {
    maxFileSizeBytes: 25 * 1024 * 1024,
    allowedContentTypes: ['image/*']
  },
  authorize: (request, context) =>
    uploadAuthorizationBoundary.authorize(request, context)
});

const result = await uploads.upload(
  {
    source: file,
    fileName: file.name
  },
  {
    onProgress: ({ phase, loadedBytes, totalBytes }) => {
      renderUploadProgress(phase, loadedBytes, totalBytes);
    }
  }
);
```

authorization adapter는 `uploadRef`, 만료 시각, replay-safe 여부, authorization 범위의 파일 제한, body 없는 provider `Request`를 만드는 closure, completion callback을 반환한다. request ID, trace ID, idempotency key와 같은 ZDP 식별자는 authorization·completion callback에만 전달되고 provider 요청에는 붙지 않는다.

기본 fetch transport는 시작과 완료 시점의 진행률을 제공한다. browser에서 byte 단위 진행률이 필요하면 `createZdpXhrUploadTransport()`를 `transfer`로 전달한다. 기본 SHA-256 계산은 Web Crypto와 `Blob.arrayBuffer()`를 사용하므로 대용량 파일에는 미리 계산한 checksum이나 custom `checksumProvider`를 사용한다.

## 검증

`contracts:check`는 SDK generation source, libs export source, SDK surface, auth helper, upload client 계약을 읽고 SDK가 다음 경계를 잃지 않았는지 확인한다. `generation:plan`은 같은 계약, `zdp-api-contracts/contracts/sdk-generation-input.yaml`, `zdp-api-contracts`의 API export dry-run plan handoff를 함께 읽고 TypeScript, Dart, Rust SDK를 어떤 입력에서 만들 예정인지 dry-run 계획만 만든다.

- TypeScript, Dart, Rust SDK surface는 같은 API 계약을 소비한다.
- SDK generation source는 `zdp-api-contracts/contracts/sdk-generation-input.yaml`만 입력 원천으로 쓴다.
- API SDK generation input drift 검증은 `zdp-api-contracts`와 `zdp-client-sdks`가 generation target, route metadata, success status metadata, error metadata, webhook metadata, forbidden values를 다르게 주장하는 일을 막는다.
- API export dry-run plan handoff 검증은 API repo의 실제 `buildApiExportPlan()` 결과를 읽어 OpenAPI, SDK generation input, docs contract, webhook schema 산출면, route operation id, typed fetch operation map, typed fetch runtime metadata, mutation idempotency policy, forbidden values를 같은 계약에서 뽑겠다는 보장을 SDK plan도 보게 만든다. 이게 없으면 API 쪽은 `permission_check`, `audit_event`, `idempotency`, `success_statuses`, `request_id`, `trace_id`, timeout/abort signal, route/webhook 금지값을 함께 묶겠다고 말하는데 SDK 쪽은 일부 YAML만 보고 지나가서, 나중에 SDK가 문서나 OpenAPI와 다른 안전장치를 갖는 일이 생긴다.
- libs export source는 `zdp-libs-ts/schema`, `zdp-libs-ts/env-contract`, `zdp-libs-ts/event-contracts`, `zdp-libs-ts/error`, `zdp-libs-ts/i18n-contract`만 공통 계약 입력으로 참조한다.
- route metadata의 `idempotency`는 같은 요청이 두 번 들어와도 SDK가 재시도 안전성을 잃지 않게 해준다.
- route metadata의 `owner_boundary`, `tenant_boundary`, `request_id_required`, `trace_id_required`, `session_effect`, `credential_policy`는 SDK가 auth/session route를 일반 CRUD처럼 취급하지 않게 해준다.
- route metadata의 `success_statuses`는 언어별 SDK가 성공 응답 처리 기준을 서로 다르게 해석하지 않게 해준다.
- error metadata의 `request_id`, `trace_id`는 사용자가 겪은 실패를 서버 로그와 연결할 수 있게 해준다.
- libs metadata의 `schema_id`, `error_code`, `message_key`, `request_id`, `trace_id`는 SDK 생성기가 스키마 이름, 에러 코드, 번역 키, 추적 식별자를 언어별로 따로 지어내지 않게 해준다.
- webhook metadata의 `idempotency_key`, `replay_policy`, `dead_letter_policy`는 중복 이벤트와 실패 이벤트를 SDK 표면에서 숨기지 않게 해준다.
- SDK는 typed fetch operation map, `request_id`, `trace_id`, idempotency key 전파, 표준 error envelope 정규화, timeout option, abort signal, pagination metadata handoff, upload handoff 기준을 유지한다. 자동 페이지 순회는 현재 runtime 범위가 아니다.
- SDK는 API export plan handoff에서 검증한 operation metadata를 TypeScript typed fetch runtime에 연결 가능한 operation definitions로 노출한다. 또한 API schema bundle의 `required_fields`, `secret_fields`, `session_effect`를 generated schema model metadata로 노출하고, generated typed fetch runtime에서 request/response required field 누락을 실패로 잡는다. 이 단계는 schema별 encoder/decoder나 언어별 구현 타입을 생성하지 않으므로 API 계약 원천을 소유하지 않는다.
- HTTP 204 success response는 body가 없는 HTTP 의미를 보존해 `undefined`로 반환하며, body를 가질 수 있는 success response에만 generated response required field 검증을 적용한다.
- SDK는 API contract source가 아니다.
- auth helper는 access token 부착 경계만 소유하고 refresh token storage, session token storage, raw credential storage, membership authority, entitlement authority를 소유하지 않는다.
- upload client는 signed upload request shape, error mapping, request/trace/idempotency propagation, local·authorization file limit, checksum, progress, cancellation, replay-safe transfer retry를 소유한다. bucket name, raw provider URL, signed URL persistence, provider response body, file ownership decision은 공개 계약으로 만들지 않는다.

이렇게 해두면 SDK가 클라이언트 편의 코드라는 이유로 API 원천, libs package 원천, refresh token 저장소, 권한 최종 판단자, provider URL 공개 계약으로 커지는 일을 checker 단계에서 먼저 막을 수 있다. 또한 raw customer payload, provider secret, provider token, authorization header, refresh token plaintext, stack trace 같은 값이 SDK 생성 입력으로 섞이는 것을 금지해서, SDK 패키지가 민감한 운영 데이터를 예시나 타입으로 굳히는 사고를 줄인다. dry-run generation plan은 실제 파일을 만들지 않고도 이 입력 조합을 반복 검증하게 해준다. 즉 SDK 생성기가 붙기 전부터 "어느 언어가 어느 API 계약과 어느 공통 libs export를 소비하는지"가 고정되고, 실수로 한 언어만 다른 원천을 바라보는 일을 줄인다. API input drift 검증은 `trace_id`, `success_statuses`, typed fetch runtime metadata, auth/session metadata, forbidden values가 API 계약에는 있는데 SDK plan에는 없는 상태를 막아, 장애 문의 때 SDK 오류와 서버 로그를 연결할 실마리가 사라지거나 성공 응답 처리가 언어별로 갈라지는 일을 줄인다. API export plan handoff 검증은 실제 plan 결과의 `writesArtifacts`와 `publishesSchemas`가 false인지와 `typedFetchOperationMap`이 route catalog operation id와 일치하는지도 보므로, SDK 생성 준비 단계가 몰래 OpenAPI나 schema 파일을 쓰거나 publish하는 일 없이 순수 계획으로 남는다.

```bash
bun run check
bun run build
bun run smoke:package
bun run smoke:vite
bun run contracts:check
bun run api-operations:check
bun run typescript-models:check
bun run generation:plan -- --check
bun run generation:plan -- --json
```

아키텍처 검증은 `zdp-architecture-linter` 저장소 루트에서 실행한다.

```bash
bun src/cli.ts validate --architecture ../../docs/zdp-architecture --repository ../../contracts/zdp-client-sdks --json
```
