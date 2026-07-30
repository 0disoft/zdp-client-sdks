# zdp-client-sdks Runbook

This repository owns SDK surface contracts. It consumes API contracts and must not become the source of API truth.

## Normal Checks

- Use `zdp_architecture_validate_client_sdks_repository` for repository architecture policy validation.
- Use `zdp_client_sdks_check` after SDK surface, auth helper, upload client, typed fetch, checker, SDK generation source, API SDK generation input, or libs export source changes.
- Use `zdp_client_sdks_npm_pack_dry_run` for npm package contents or release-readiness evidence.
- Use `zdp_client_sdks_npm_publish_dry_run` for a tokenless npm metadata dry-run after release preparation. It never publishes.
- Treat generation-plan evidence as covered by `zdp_client_sdks_check`; inspect generated planning details only through configured checks or human/manual context.
- Keep `contracts/sdk-generation-source.yaml` pointed at `zdp-api-contracts/contracts/sdk-generation-input.yaml`.
- Keep `contracts/libs-export-source.yaml` pointed at the public `zdp-libs-ts` export surface.
- Keep SDK surface changes synchronized with `contracts/sdk-surface.yaml`.
- Keep contract `status` values inside the pre-release `skeleton`, `draft`, `reviewed` lifecycle until generated SDK packages exist.
- Keep SDK request, trace, and idempotency propagation aligned across SDK surface, upload client, API route metadata, and generation plan checks.
- Require migration notes before breaking published SDK shapes.
- Treat raw package-manager, install, publish, generation, server, and watcher commands as manual-only or missing command-contract coverage unless the root mustflow command contract exposes an eligible oneshot intent.
- Publish only by pushing the exact `v<package.json version>` tag after the matching `main` commit and branch CI have been reviewed. `.github/workflows/release.yml` is the only public npm path.
- Keep npm Trusted Publisher bound to organization `0disoft`, repository `zdp-client-sdks`, workflow `release.yml`, and environment `npm`.
- Keep the release runtime pinned to Node `24.18.0`, npm `11.16.0`, and Bun `1.3.14`; update the pins only with a reviewed patch release and fresh package evidence.
- Keep CI and release API checkouts equal to `contracts/api-contracts.lock.json`. Update that lock only together with regenerated operation metadata and full SDK checks.
- Never configure `NODE_AUTH_TOKEN` or `NPM_TOKEN` for this release workflow.
- Treat only an explicit npm registry `E404` as an unpublished version. Authentication, rate-limit, transport, malformed-response, and other registry failures stop the release.

## Failure Response

If API contract validation fails, freeze SDK generation and keep the last reviewed SDK surface.

If the local checker fails, fix the contract source first. Do not loosen the checker to allow API contract source ownership, refresh token storage, final authorization decisions, or raw provider upload URLs into SDK packages.

If SDK generation source validation fails, stop SDK refresh. The handoff contract exists so TypeScript, Dart, and Rust SDKs preserve the same route metadata, auth/session boundaries, error identifiers, webhook replay rules, and forbidden sensitive values from `zdp-api-contracts` instead of each language inventing its own version.

If libs export source validation fails, stop SDK refresh. The handoff contract exists so generated SDKs reuse the same schema, env, event, error, and i18n export names from `zdp-libs-ts` without becoming the package source of truth or copying secrets into SDK fixtures.

If generation plan validation fails, do not start SDK generation. The dry-run plan exists so TypeScript, Dart, and Rust targets keep the same API source, the same `zdp-libs-ts` export source, and the same request/trace/idempotency metadata before any generated code is written.

If API SDK generation input drift validation fails, fix `zdp-api-contracts/contracts/sdk-generation-input.yaml` or `contracts/sdk-generation-source.yaml` before SDK work continues. That check exists so API contracts and SDK planning do not silently disagree about route metadata, success status metadata, error metadata, webhook replay fields, or forbidden sensitive values. The forbidden value check is bidirectional; extra or missing values on either side are drift.

If API export plan handoff validation fails, fix `zdp-api-contracts` before SDK work continues. That check reads the actual API export plan result, not formatted source text, so OpenAPI, SDK input, docs contract, and webhook schema planning keep the same permission, audit, idempotency, success status, request, and trace metadata. Without it, SDK generation can look green while documentation or OpenAPI silently loses `idempotency`, `success_statuses`, or `trace_id`.

## npm 릴리스 실패 복구

릴리스 tag를 만들기 전에 `main`의 같은 커밋에서 CI, package check, pack dry-run, tokenless publish dry-run을 통과시킨다. tag가 push된 뒤에는 npm registry가 먼저다. GitHub Actions의 빨간 표시만 보고 미공개라고 추측하지 않는다.

| 실패 지점 | 확인할 증거 | 허용되는 복구 | 금지되는 복구 |
| --- | --- | --- | --- |
| tag 생성 전 branch CI 실패 | 대상 SHA, 실패 check, package version | 원인을 새 커밋에서 고치고 CI를 다시 통과시킨다. npm에 없는 예정 버전은 유지할 수 있다. | 실패 SHA에 tag를 만들거나 check를 건너뛰지 않는다. |
| tag push 후 publish 이전 실패 | 원격 tag SHA, `main` 포함 여부, npm exact version 부재 | tag가 원래 SHA를 유지하고 npm에 버전이 없을 때 같은 workflow run을 재실행한다. | tag 삭제·이동, 로컬 publish, token publish로 우회하지 않는다. |
| npm 공개 후 registry 검증 실패 | npm version, `gitHead`, integrity, provenance, 실패 단계 | `gitHead`와 integrity가 release artifact에 맞으면 전파 지연과 consumer 결함을 분리한다. 전파 지연은 같은 workflow로 검증을 재시도하고, package 결함은 새 patch version에서 수정한다. | 같은 version을 다시 publish하거나 dist-tag로 결함을 숨기지 않는다. |
| npm 공개 후 GitHub Release 누락 | tag SHA, npm `gitHead`, integrity, provenance | 모든 npm anchor가 맞을 때 동일 tag workflow를 재실행해 누락된 Release만 생성한다. | npm을 다시 publish하거나 새 tag를 만들지 않는다. |
| npm `gitHead` 또는 integrity 불일치 | registry metadata, 원격 tag SHA, workflow actor/run | 즉시 중단하고 incident로 기록한다. 수정본은 새 patch version으로만 공개한다. | tag 이동, version 재사용, workflow 반복으로 덮지 않는다. |
| GitHub Release만 있고 npm version 없음 | Release tag SHA, publish workflow, npm exact version | Release를 성공 증거로 쓰지 않는다. tag가 정확하고 npm에 없을 때만 workflow를 재실행한다. | Release 본문만 보고 공개 완료로 처리하지 않는다. |

### 판정 순서

1. package name과 version을 고정한다.
2. 로컬 `main`, 원격 `main`, 원격 `v<version>` SHA를 기록한다.
3. npm exact version 존재 여부를 확인한다.
4. npm version이 있으면 `gitHead`와 원격 tag SHA를 먼저 비교한다.
5. SHA가 맞을 때만 integrity, tarball, provenance, registry signature, 빈 consumer 결과를 확인한다.
6. 공개된 package bytes나 exports가 잘못됐으면 기존 version을 손대지 않고 patch version을 올린다.

### 반드시 남길 증거

- package name과 version
- 로컬 `main`, 원격 `main`, 원격 tag SHA
- branch CI와 tag publish workflow URL, run ID, 결론
- npm version, `gitHead`, `dist.integrity`, tarball URL
- provenance predicate와 `npm audit signatures` 결과
- GitHub Release URL, tag, draft/prerelease 상태, asset integrity
- 장애 확인 시각과 선택한 복구 동작

## Manual Review Required

- SDK publish
- Auth helper behavior changes
- Breaking TypeScript, Dart, or Rust SDK surface changes
