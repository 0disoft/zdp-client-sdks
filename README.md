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
- signed upload client handoff 기준
- npm Trusted Publisher, immutable release artifact, packed/published consumer smoke
- SDK generation dry-run plan과 checked-in generated source drift 검증

## 현재 제외

- Dart와 Rust generated runtime 및 package publishing
- API 계약에 선언되지 않은 제품별 convenience model
- 중첩 object 내부까지 추론하는 독립 schema language
- 자동 페이지 순회
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

패키지는 Bun과 TypeScript bundler가 `src/`의 TypeScript source export를 직접 소비하는 source package다. public export는 package root, `zdp-client-sdks/typed-fetch`, `zdp-client-sdks/typed-fetch/api-operations`다. generated TypeScript models와 client facade는 `src/`에 포함되지만 Dart와 Rust runtime artifact는 package에 포함하지 않는다.

공개 릴리스는 `package.json` 버전과 같은 `v<version>` tag가 `main`에 포함된 commit을 가리킬 때만 실행된다. GitHub Actions의 npm Trusted Publisher가 OIDC로 검증된 tarball을 공개하며 장기 npm token이나 로컬 `npm publish`는 사용하지 않는다. 공개 전 packed consumer, 공개 후 npm `gitHead`, integrity, registry signature, SLSA provenance, GitHub Release asset을 같은 commit과 대조한다.

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

## 검증

```bash
bun run check
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
