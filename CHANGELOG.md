# CHANGELOG.md

## Unreleased

## 0.5.1

### Changed

- SDK generation plan이 `zdp-api-contracts`의 API export dry-run plan handoff까지 검증하도록 했다.
- API export plan의 `sdk_generation_input`, `openapi`, `docs_contract`, `webhook_schema`, `request_id`, `trace_id`, dry-run 보장이 깨지면 SDK 생성 계획도 실패하도록 했다.

## 0.5.0

### Added

- Client SDK 저장소 골격을 추가했다.
- SDK surface, auth helper, upload client contract skeleton을 추가했다.
- SDK surface, auth helper, upload client 계약을 읽는 repo-local checker skeleton을 추가했다.
- SDK generation source handoff 계약과 checker 검증을 추가했다.
- `zdp-libs-ts` public export source handoff 계약과 checker 검증을 추가했다.
- SDK generation dry-run plan skeleton과 `generation:plan` 검증을 추가했다.
- `generation:plan`이 `zdp-api-contracts/contracts/sdk-generation-input.yaml`을 읽고 client SDK generation source와 drift를 비교하도록 했다.
