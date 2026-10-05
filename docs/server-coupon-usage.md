# 제품 서버의 쿠폰 연결

`zdp-client-sdks/server-coupon-usage`에서 `createServerCouponUsageClient`를
가져온다. 이 모듈은 로컬·스테이징 서버 호출만 지원하며 루트 export에는 없다.
가격, 예약 생성, 제품 실행, 인증정보 저장, 권한 판단은 맡지 않는다.

제품 DB에 이용 요청·예약·request ID·trace ID를 저장한 뒤 `capture`에
`usageRef`, `holdRef`, `requestId`, `traceId`를 전달한다. Money origin은 서버
설정에서 읽으며, 서비스 인증정보는 `getServiceCredential(signal)`에서 매번
받는다. SDK는 같은 예약을 다시 만드는 기능이나 자동 재시도 루프를 제공하지 않는다.

- `captured`: 영수증을 제품 DB에 저장한 뒤 결과 제공을 진행한다. 금액은
  십진 문자열이다. 실제 계산이 필요하면 `BigInt`를 사용한다.
- `rejected`: Money의 요청·인증·권한·예약·충돌 오류다. 오류 코드를 보고
  원인을 해결하며 결과 제공을 진행하지 않는다.
- `unknown`: 요청 후 시간 초과, 중단, 통신 오류, 503 또는 검증할 수 없는
  응답이다. 같은 이용 요청과 예약으로 확인한다. 새 예약이나 자동 취소를 하지 않는다.
- `not_submitted`: 인증정보 확보 실패 또는 요청 전 중단이다. 결과 제공을
  진행하지 않으며 같은 이용 요청을 유지한다.

SDK의 정상 응답은 실제 제품 결과 제공 완료를 뜻하지 않는다. 제품은 예약을
만든 서비스 ID와 Core의 `coupon-usage:capture` 권한을 정확히 맞추고,
동시 작업·서버 재시작에도 영수증 저장과 결과 제공이 중복되지 않도록 구현해야 한다.
현재 적용 제품·유료 기능·가격·배포 연결은 선택하거나 활성화하지 않았다.

모델은 `zdp-api-contracts`의 내부 JSON Schema에서 생성한다.
`bun run server-coupon-usage:sync`로 생성하고 `:check`로 원천과의 차이를 확인한다.
CI와 release의 API checkout은 같은 원천 commit에 맞춰져 있다. 원격 반영 시
API 계약 commit을 SDK보다 먼저 포함해야 한다.

이번 추가는 새로운 package subpath이므로 다음 발행 때 minor 버전 검토가
필요하다. 현재 작업은 로컬 구현이며 package 버전을 자동으로 올리지 않는다.
