# SDK SemVer Compatibility Gate

이 문서는 generated ZDP SDK 공개 표면의 호환성 판정과 package version gate를 정의한다. API 계약의 의미를 새로 정하지 않고, 이미 체크인된 generated operation, schema metadata, TypeScript runtime field descriptor를 직전 공개 버전과 비교한다.

## Baseline

`bun run sdk-semver:check`는 현재 commit에서 도달 가능한 가장 최신 stable `v<semver>` tag를 기준점으로 사용한다. 현재 package version과 같은 tag가 현재 HEAD를 가리키면 release 재검증으로 보고 그 이전 tag를 선택한다. 같은 version tag가 과거 commit을 가리키면 해당 tag와 현재 변경을 비교한다.

CI checkout은 전체 history와 tag를 받아야 한다. tag가 없는 첫 공개 릴리스만 `--allow-initial-release`로 명시적으로 우회할 수 있다. 특정 기준점을 재현할 때는 `--baseline-ref <git-ref>` 또는 `SDK_SEMVER_BASELINE_REF`를 사용한다.

## Compatibility Rules

| 변경 | 판정 |
| --- | --- |
| operation 삭제 | breaking |
| HTTP method, path, request/response schema ref, response body mode 변경 | breaking |
| auth, request ID, trace ID, idempotency 요구 강화 | breaking |
| success status 삭제 | breaking |
| 새 error code 추가 | breaking |
| request required field 추가 또는 기존 request field 삭제 | breaking |
| response field 삭제 또는 required field를 optional로 완화 | breaking |
| field wire type 변경 | breaking |
| request enum 값 삭제 | breaking |
| response enum 값 추가 | breaking |
| 새 operation, 새 schema, optional request field, response field 추가 | additive |
| 요구사항 완화와 허용 범위 확대 | additive |
| generated 공개 표면 차이 없음 | none |

새 error code와 response enum 값은 기존 exhaustive handler가 처리하지 못하므로 breaking으로 본다. request enum 값 추가와 response enum 값 삭제는 기존 소비자를 깨지 않으므로 additive로 본다.

## Version Policy

`none`은 기존 version 유지와 patch 이상 증가를 허용한다. `additive`는 minor 이상 증가를 요구한다. `breaking`은 `0.x`에서는 minor 이상, `1.x` 이후에는 major 증가를 요구한다. 이미 공개된 version보다 낮은 package version은 공개 표면 차이가 없어도 실패한다.

breaking 변경은 다음 경로의 migration note를 반드시 포함한다.

```text
docs/migrations/v<baseline>-to-v<current>.md
```

migration note는 양쪽 version, `## Breaking changes` 또는 `## 호환성 중단 변경` heading, 실제 호출부를 고칠 수 있는 지침을 포함해야 한다.

## Commands

```bash
bun run sdk-semver:check
bun run sdk-semver:check -- --json
bun run sdk-semver:check -- --baseline-ref v0.15.3
```

JSON 출력은 `zdp.sdk-semver-report/v1` schema를 사용하며 baseline/current API lock revision, 최종 classification, 필요한 version bump, migration note 경로, 개별 변화 코드를 포함한다.

## Scope

이 gate는 `ZDP_TYPED_FETCH_OPERATION_MAP`, `ZDP_API_SCHEMA_MODEL_MAP`, `ZDP_API_SCHEMA_RUNTIME_TYPE_MAP`을 비교한다. 내부 구현, 성능, retry algorithm, package export 구조처럼 generated API 표면 밖의 변경은 기존 package review와 consumer smoke가 계속 담당한다.
