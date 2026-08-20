# Typed Fetch 및 인증 계약

Typed fetch는 operation metadata를 SDK 소비자에게 그대로 노출한다. request id, trace id, timeout, abort signal, idempotency key, success status metadata, pagination metadata handoff, bounded JSON response 처리와 표준 error envelope 처리는 SDK 경계다. 자동 페이지 순회는 구현하지 않는다.

API base URL에는 username이나 password를 넣을 수 없다. runtime은 HTTPS origin과 localhost 개발 URL만 허용하며, 거부한 URL 원문을 configuration error에 반복하지 않는다.

JSON response는 parsing 전에 byte limit을 적용한다. `retry_after_seconds`를 확인하기 위해 clone한 retry response도 같은 한도를 쓴다. 기본값은 4 MiB이며 client 또는 개별 call에서 조정한다. 한도를 넘으면 protocol error로 실패하고 cloned stream branch를 기다리며 교착되지 않도록 body cancellation을 비동기로 처리한다.

Caller signal과 timeout signal을 합칠 때 등록한 listener는 첫 abort 또는 request 종료 시 제거한다. 같은 caller signal을 여러 요청에서 재사용해도 완료된 요청의 listener가 남지 않아야 한다.

HTTP 204 success response는 `undefined`로 decode한다. body를 가질 수 있는 success response에만 generated response schema field 검증을 적용한다.

Generated schema metadata는 required field와 optional field를 분리한다. Product-link exchange는 account-only link에서 필수가 아닌 `workspace_ref`를 존재할 때만 노출한다.

Auth helper는 caller가 제공한 access token을 요청에 부착한다. refresh token storage, session lifecycle, raw credential storage, membership authority, entitlement authority와 최종 authorization decision은 소유하지 않는다.

Auth 및 session metadata를 일반 CRUD helper로 평탄화하지 않는다.
