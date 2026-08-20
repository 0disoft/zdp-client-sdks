# SECURITY.md

## 보안 경계

`zdp-client-sdks`는 SDK 생성 입력, typed fetch runtime, 표준 오류 처리, auth helper와 signed upload runtime을 소유한다. 이 저장소는 session 발급, refresh 정책, 권한 판단, credential vault, provider token 저장소의 소유자가 아니다.

Product-link `proof_verifier`는 exchange 요청의 input-only secret이다. SDK는 호출 중 전달만 할 수 있고 저장, 재사용, 로그, 오류 세부정보, generated fixture의 원문 값으로 남기면 안 된다.

Signed upload runtime은 provider URL을 ephemeral `Request` factory 안에서만 사용한다. 결과와 오류에는 upload reference, object reference, 상태, 크기, MIME, checksum만 남긴다. provider 요청에는 ZDP Authorization, cookie, request ID, trace ID, idempotency key를 복사하지 않으며, provider 응답 본문을 오류 메시지나 completion result로 전달하지 않는다.

Provider transfer 재시도는 authorization boundary가 `replaySafe: true`를 명시한 경우에만 허용한다. timeout과 caller cancellation은 authorization, provider transfer, retry delay, completion callback이 공유하는 signal로 전파한다.

## 금지 항목

다음 값은 SDK source, 계약, 테스트 fixture, 문서, package output에 넣지 않는다.

- 실제 access token, refresh token, session token, session cookie
- 실제 product-link proof verifier
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
- upload client가 raw provider URL을 public contract나 persistent state로 노출하는 경우
- replay-safe 확인 없이 provider transfer를 자동 재시도하는 경우
- provider response body나 signed request header가 공개 오류로 전달되는 경우
- error normalization이 provider secret, stack trace, 내부 URL을 사용자 응답으로 전달할 수 있는 경우

## 신고 방법

공개 issue에는 secret이나 실제 고객 데이터를 쓰지 않는다. 재현에는 synthetic value를 사용하고, 민감값이 포함된 사고는 maintainer에게 비공개 채널로 먼저 전달한다.
