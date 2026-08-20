# Package Surface Contract

The public package surface is limited to the package root, `./typed-fetch`, `./typed-fetch/api-operations`, and `./upload`.

The package file allowlist contains source skeletons, contracts, operating documents, service contract, security guidance, changelog, contribution guidance, and license. It does not include generated language-specific runtime artifacts.

Package metadata, packaged documents, contract files, or source files require package version impact review before release work.

## 공개 경계

패키지는 Bun과 TypeScript bundler가 `src/`의 TypeScript source export를 직접 소비하는 계약이다. Node가 `node_modules` 안의 TypeScript를 직접 실행하는 범용 JavaScript package라고 주장하지 않는다.

`./upload`은 signed upload authorization, provider transfer, completion을 조율하는 TypeScript runtime이다. provider URL은 ephemeral `Request` factory 내부에만 존재하며 package result나 error surface로 승격하지 않는다.

## 릴리스 경계

공개는 `main`에 포함된 exact version tag가 시작하는 GitHub Actions Trusted Publisher workflow만 사용한다. workflow는 release commit을 넣은 정확한 tarball을 먼저 빈 Bun consumer에 설치하고, 같은 파일을 npm에 publish한다. 공개 뒤에는 npm `gitHead`, integrity, registry signature, SLSA provenance, 빈 registry consumer와 GitHub Release 자산을 확인한다.

로컬 npm token publish, 이미 공개된 version 재사용, tag 이동, packed smoke와 다른 tarball publish는 금지한다. 실패 복구 기준은 `RUNBOOK.md`가 소유한다.
