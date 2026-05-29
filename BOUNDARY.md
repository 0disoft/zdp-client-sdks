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

소유하지 않는다:

- API 계약 원천
- backend authorization
- token vault
- product-specific business rules
- generated docs source of truth

## 분리 트리거

- 언어별 SDK가 독립 release cadence를 요구한다.
- SDK runtime helper와 generated model이 서로 다른 compatibility policy를 요구한다.
- public API adoption이 language-specific support boundary를 요구한다.
