# zdp-client-sdks

ZDP client SDK 저장소다. 초기 목적은 TypeScript, Dart, Rust SDK가 나중에 같은 API 계약을 소비하도록 생성 입력, 인증 헬퍼, 표준 오류 처리, 업로드 클라이언트 경계를 고정하는 것이다.

## 현재 범위

- SDK generation input handoff 기준
- TypeScript, Dart, Rust SDK surface skeleton
- 인증 토큰 처리 경계
- 표준 error envelope 처리 기준
- signed upload client handoff 기준
- 계약 파일을 읽는 one-shot checker

## 현재 제외

- 실제 SDK 코드 생성 결과
- live API base URL
- refresh token 보관
- 제품별 business rule
- core, money, privacy 데이터 직접 접근
- API 계약 원천 소유

## 계약

루트 `service.yaml`이 이 저장소의 서비스 계약이다. `contracts/` 아래 파일은 실제 SDK 구현이 생기기 전에 public surface와 금지선을 고정하는 skeleton이다.

## 검증

`contracts:check`는 SDK surface, auth helper, upload client 계약을 읽고 SDK가 다음 경계를 잃지 않았는지 확인한다.

- TypeScript, Dart, Rust SDK surface는 같은 API 계약을 소비한다.
- SDK는 `request_id` 전파, 표준 error envelope, pagination, upload handoff 기준을 유지한다.
- SDK는 API contract source가 아니다.
- auth helper는 access token 부착 경계만 소유하고 refresh token storage, membership authority, entitlement authority를 소유하지 않는다.
- upload client는 signed upload request shape과 error mapping을 소유하지만 bucket name, raw provider URL, file ownership decision을 공개 계약으로 만들지 않는다.

이렇게 해두면 SDK가 클라이언트 편의 코드라는 이유로 API 원천, refresh token 저장소, 권한 최종 판단자, provider URL 공개 계약으로 커지는 일을 checker 단계에서 먼저 막을 수 있다.

```bash
bun run check
bun run contracts:check
```

아키텍처 검증은 `zdp-architecture-linter`에서 이 저장소를 대상으로 실행한다.

```bash
bun src/cli.ts validate --architecture ..\..\docs\zdp-architecture --repository ..\..\contracts\zdp-client-sdks --json
```
