# SECURITY.md

## 보안 경계

`zdp-client-sdks`는 SDK 생성 입력, typed fetch runtime, 표준 오류 처리, auth helper와 upload client 계약을 소유한다. 이 저장소는 session 발급, refresh 정책, 권한 판단, credential vault, provider token 저장소의 소유자가 아니다.

## 금지 항목

다음 값은 SDK source, 계약, 테스트 fixture, 문서, package output에 넣지 않는다.

- 실제 access token, refresh token, session token, session cookie
- Authorization header 원문
- OAuth provider secret, webhook secret, storage signed URL 원문
- passkey challenge, assertion, attestation 원문
- 실제 고객 식별자, 이메일, 전화번호, 결제 식별자
- provider raw response 전문
- stack trace나 내부 error body를 그대로 담은 공개 오류 예시

## 신고 기준

아래 변경은 보안 리뷰가 필요하다.

- SDK가 refresh token이나 session token을 저장하거나 로깅할 수 있는 경우
- typed fetch runtime이 인증 없는 호출에 Authorization header를 붙일 수 있는 경우
- timeout, abort, retry, idempotency key 처리 변경으로 mutation 중복 실행 위험이 생기는 경우
- upload client가 raw provider URL을 public contract로 노출하는 경우
- error normalization이 provider secret, stack trace, 내부 URL을 사용자 응답으로 전달할 수 있는 경우

## 신고 방법

공개 issue에는 secret이나 실제 고객 데이터를 쓰지 않는다. 재현에는 synthetic value를 사용하고, 민감값이 포함된 사고는 maintainer에게 비공개 채널로 먼저 전달한다.

