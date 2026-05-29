# CONTRIBUTING.md

## 변경 원칙

- SDK surface 변경은 `zdp-api-contracts`의 route/error/schema 계약과 맞춘다.
- 언어별 SDK가 서로 다른 동작을 갖지 않도록 공통 contract를 먼저 바꾼다.
- 인증, refresh, upload, pagination, error 처리 변경은 migration note를 남긴다.
- generated output은 원천 계약이 아니다.

## 검증

아키텍처 검증은 `zdp-architecture-linter`에서 이 저장소 루트를 대상으로 실행한다. 언어별 build/test는 실제 SDK 코드가 생긴 뒤 추가한다.

## 릴리스

아직 SDK 릴리스는 없다. public SDK가 생기면 `CHANGELOG.md`에 언어별 호환성 영향을 기록한다.
