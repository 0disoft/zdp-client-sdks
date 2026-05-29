# AGENTS.md

## 역할

이 저장소는 ZDP client SDK 산출물의 경계를 소유한다. 초기 범위는 TypeScript, Dart, Rust SDK의 생성 입력, 인증 헬퍼, 표준 오류 처리, 업로드 클라이언트 계약이다.

## 작업 원칙

- 문서는 한국어로 작성한다.
- SDK는 `zdp-api-contracts`를 소비한다. API 계약의 원천이 되면 안 된다.
- SDK는 token 저장소, refresh 정책, 권한 판단의 최종 소유자가 아니다.
- 화면별 편의 payload보다 API resource와 error envelope를 보존한다.
- `service.yaml`이 이 저장소의 운영 계약이며 변경 시 `zdp-architecture` catalog와 함께 맞춘다.

## 금지

- SDK에 제품별 business rule을 넣지 않는다.
- 인증 토큰 원문이나 refresh token 예시를 커밋하지 않는다.
- SDK가 core/money/privacy DB를 직접 읽는 경로를 만들지 않는다.
- public API가 확정되기 전 live base URL을 하드코딩하지 않는다.

## 검증

초기 검증은 `zdp-architecture-linter`에서 이 저장소 루트를 대상으로 수행한다. 언어별 build/test는 실제 SDK 코드가 추가될 때 연결한다.
