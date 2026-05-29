# zdp-client-sdks

ZDP client SDK 저장소다. 초기 목적은 TypeScript, Dart, Rust SDK가 나중에 같은 API 계약을 소비하도록 생성 입력, 인증 헬퍼, 표준 오류 처리, 업로드 클라이언트 경계를 고정하는 것이다.

## 현재 범위

- SDK generation input handoff 기준
- TypeScript, Dart, Rust SDK surface skeleton
- 인증 토큰 처리 경계
- 표준 error envelope 처리 기준
- signed upload client handoff 기준

## 현재 제외

- 실제 SDK 코드 생성 결과
- live API base URL
- refresh token 보관
- 제품별 business rule
- core, money, privacy 데이터 직접 접근

## 계약

루트 `service.yaml`이 이 저장소의 서비스 계약이다. `contracts/` 아래 파일은 실제 SDK 구현이 생기기 전에 public surface와 금지선을 고정하는 skeleton이다.

## 검증

아키텍처 검증은 `zdp-architecture-linter`에서 이 저장소를 대상으로 실행한다.

```bash
bun src/cli.ts validate --architecture ..\..\docs\zdp-architecture --repository ..\..\contracts\zdp-client-sdks --json
```
