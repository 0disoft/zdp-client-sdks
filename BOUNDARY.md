# BOUNDARY.md

## 소유 경계

`zdp-client-sdks`는 API 계약을 소비하는 client SDK surface를 소유한다.

소유한다:

- TypeScript SDK surface
- Dart SDK surface
- Rust SDK 후보 surface
- auth token handling boundary
- standard error handling
- upload client handoff
- SDK contract checker

소유하지 않는다:

- API 계약 원천
- backend authorization
- token vault
- product-specific business rules
- generated docs source of truth
- refresh token storage
- final authorization decisions
- raw provider URLs as public contract

## 분리 트리거

- 언어별 SDK가 독립 release cadence를 요구한다.
- SDK runtime helper와 generated model이 서로 다른 compatibility policy를 요구한다.
- public API adoption이 language-specific support boundary를 요구한다.
- checker가 API 계약 원천 소유나 refresh token 저장을 허용해야만 통과한다.
