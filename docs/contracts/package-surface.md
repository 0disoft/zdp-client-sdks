# Package Surface Contract

The public package surface is limited to the package root, `./typed-fetch`, and `./typed-fetch/api-operations`.

The package file allowlist contains TypeScript source, generated TypeScript models, SDK contracts, operating documents, service contract, security guidance, changelog, contribution guidance, and license. Dart and Rust generated runtime artifacts are not included.

Package metadata, packaged documents, contract files, generated TypeScript source, or runtime source require package version impact review before release work.

## 공개 경계

패키지는 Bun과 TypeScript bundler가 `src/`의 TypeScript source export를 직접 소비하는 계약이다. Node가 `node_modules` 안의 TypeScript를 직접 실행하는 범용 JavaScript package라고 주장하지 않는다.

`createZdpClient()`와 generated request/response model은 public TypeScript surface다. generator script와 cross-repository handoff reader는 package export로 공개하지 않는다. API route와 required/optional field source of truth는 계속 `zdp-api-contracts`가 소유한다.

## 릴리스 경계

공개는 `main`에 포함된 exact version tag가 시작하는 GitHub Actions Trusted Publisher workflow만 사용한다. workflow는 release commit을 넣은 정확한 tarball을 먼저 빈 Bun consumer에 설치하고 같은 파일을 npm에 publish한다. 공개 뒤에는 npm `gitHead`, integrity, registry signature, SLSA provenance, 빈 registry consumer와 GitHub Release asset을 확인한다.

로컬 npm token publish, 이미 공개된 version 재사용, tag 이동, packed smoke와 다른 tarball publish는 금지한다. 실패 복구 기준은 `RUNBOOK.md`가 소유한다.
