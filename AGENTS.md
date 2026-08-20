# AGENTS.md

## 읽는 순서

1. `AGENTS.md`
2. `service.yaml`
3. `BOUNDARY.md`
4. `SECURITY.md`
5. `CHECKLIST.md`
6. `VALIDATION.md`
7. `.agents/README.md`
8. `.agents/context-map.md`
9. `README.md`
10. `RUNBOOK.md`
11. `docs/README.md`
12. 작업 범위에 맞는 `.agents/checklists/*.md`
13. 작업 범위에 맞는 `.agents/skills/*/SKILL.md`
14. 작업 범위에 맞는 `.agents/validations/*.md`
15. 관련 `contracts/**`, `src/**`, `scripts/**`, `tests/**`, `package.json`

## 역할

이 저장소는 ZDP client SDK 산출물의 경계를 소유한다. TypeScript는 generated request/response model, operation namespace client, typed fetch runtime을 구현하며 Dart와 Rust는 같은 API 계약을 소비하는 생성 계획을 유지한다.

## 작업 원칙

- 문서는 한국어로 작성한다.
- SDK는 `zdp-api-contracts`를 소비한다. API 계약의 원천이 되면 안 된다.
- `contracts/typescript-sdk-models.yaml`은 TypeScript representation만 소유하고 API field 존재나 required/optional 상태를 소유하지 않는다.
- SDK는 token 저장소, refresh 정책, 권한 판단의 최종 소유자가 아니다.
- 화면별 편의 payload보다 API resource와 error envelope를 보존한다.
- generated file은 대응 generator와 drift check를 함께 변경한다.
- `service.yaml`이 이 저장소의 운영 계약이며 변경 시 `zdp-architecture` catalog와 함께 맞춘다.

## 금지

- SDK에 제품별 business rule을 넣지 않는다.
- 인증 토큰 원문이나 refresh token 예시를 커밋하지 않는다.
- SDK가 core/money/privacy DB를 직접 읽는 경로를 만들지 않는다.
- public API가 확정되기 전 live base URL을 하드코딩하지 않는다.
- generated TypeScript model을 손으로만 수정하고 generation contract를 방치하지 않는다.

## 검증

Agent가 실행하는 검증은 root mustflow command contract에 등록된 intent만 사용한다.

- 저장소 architecture contract: `zdp_architecture_validate_client_sdks_repository`
- SDK surface, TypeScript models, domain client, typed fetch, auth helper, upload client, generation plan: `zdp_client_sdks_check`
- npm package contents 또는 release readiness: `zdp_client_sdks_npm_pack_dry_run`
- release 준비 후 network gate가 있는 tokenless publish dry-run: `zdp_client_sdks_npm_publish_dry_run`

Raw package-manager, install, publish, generation, watcher, server 명령은 `VALIDATION.md`에 manual-only 또는 missing coverage로 표시된 경계를 따른다. 실제 public publish는 로컬 intent가 아니라 exact version tag와 npm Trusted Publisher workflow만 사용한다.
