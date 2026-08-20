# Upload Client Contract

업로드 클라이언트는 `authorize → provider transfer → complete` 단계를 하나의 호출로 묶는다. 서버 소유 authorization adapter는 signed provider request를 `createRequest()` 클로저 안에 가두며, SDK의 결과·오류·진행 이벤트에는 URL이나 provider 응답 본문이 들어가지 않는다.

## 소유 범위

클라이언트는 로컬 및 authorization 단계의 파일 크기·MIME 제한, SHA-256 checksum handoff, request·trace·idempotency 식별자 전파, timeout·취소, 진행률, replay-safe로 명시된 단일 파일 전송의 제한적 재시도를 소유한다.

기본 fetch transport는 전송 시작과 완료 진행률을 제공한다. 브라우저에서 세밀한 byte 진행률이 필요하면 `createZdpXhrUploadTransport()`를 사용한다. 대용량 파일은 기본 Web Crypto checksum 대신 미리 계산한 checksum이나 `checksumProvider`를 전달해 전체 `arrayBuffer()` 할당을 피한다.

## 금지 범위

SDK는 bucket 이름, raw provider URL, signed URL 보관, provider credential, provider 응답 본문, 파일 소유권 판단, multipart orchestration을 공개 계약으로 만들지 않는다. provider Request에는 ZDP Authorization, cookie, request ID, trace ID, idempotency key를 전달하지 않는다.

재시도는 authorization 결과가 `replaySafe: true`를 선언한 경우에만 수행한다. POST form이나 재실행 안전성이 확인되지 않은 provider 요청은 `replaySafe: false`로 두며 한 번만 전송한다.
