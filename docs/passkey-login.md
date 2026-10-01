# 패스키 로그인 SDK

`core.auth.passkeyLoginBegin.create()`는 빈 JSON 본문으로 시작하고, 응답의 `ceremony_id`와 `options.publicKey`를 브라우저 WebAuthn 어댑터에 전달한다. `core.auth.passkeyLoginComplete.create({ ceremony_id, credential })`는 브라우저가 직렬화한 인증 응답을 전송한다. 두 operation은 같은 origin의 계정 BFF에 연결해야 하며 비공개 Core에 직접 연결하지 않는다. 새 API는 아직 handler·UI 연결 전 후보이고 SDK 추가만으로 사용할 수 있게 되지는 않는다.

SDK에는 로그인 ID, 계정 선택 힌트, RP 지정, `browser_binding`이 필요하지 않다. 바인딩 쿠키와 서명된 서버 전달은 BFF·Edge가 소유한다. 세션은 HttpOnly 쿠키로 발급되고 성공 JSON에는 계정·세션 참조와 만료 시각만 들어간다. CSRF 헤더는 호출자가 계정 BFF의 발급 정책에 맞춰 전달해야 한다.

`options`와 `credential`은 `ZdpJsonObject`로 운반한다. WebAuthn JSON의 base64url·RP·사용자 확인 검증은 브라우저 어댑터 및 Core가 소유하며 SDK의 object 검사가 인증 검증을 대신하지 않는다. opaque JSON을 보관하거나 로그로 출력하지 않는다.

두 operation은 `idempotency: not_required`다. 명시적 키나 SDK의 키 factory가 있더라도 HTTP 429·503·network error를 자동 재시도하지 않는다. 완료 응답이 불확실하면 같은 인증 응답을 다시 보내지 않고 새 ceremony부터 시작한다. 기존 operation의 멱등성과 재시도 동작은 유지한다.

이 문서의 경로와 필드 원천은 `zdp-api-contracts/contracts/apis/core-api/passkey-login.yaml`, `contracts/apis/catalog.yaml`, `docs/contracts/passkey-login.md`다. SDK 모델은 configured sync intent로 생성하고 해당 원천의 commit revision을 lock과 workflow checkout에 함께 반영한다.
