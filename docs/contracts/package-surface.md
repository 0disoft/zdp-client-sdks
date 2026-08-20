# Package Surface Contract

The public package surface is limited to the package root, `./typed-fetch`, `./typed-fetch/api-operations`, and `./upload`.

The npm package publishes compiled ESM under `dist/` and matching TypeScript declarations. The package file allowlist contains compiled runtime output, contracts, operating documents, service contract, security guidance, changelog, contribution guidance, and license. It does not publish `src/`, checker implementations, generation-plan implementations, tests, or generated language-specific runtime artifacts.

Package metadata, packaged documents, contract files, public runtime source, or build output rules require package version impact review before release work.

## 공개 경계

패키지의 모든 runtime export는 `dist/**/*.js`를 가리키고 모든 type export는 같은 구조의 `dist/**/*.d.ts`를 가리킨다. 소비자가 `node_modules` 안의 TypeScript source를 직접 실행하거나 번들러별 TypeScript loader 동작에 의존하게 만들지 않는다.

공개 tarball은 빈 소비자에서 Node와 Bun의 direct ESM import, TypeScript `NodeNext` declaration resolution을 통과해야 한다. 일반 CI는 같은 tarball을 Vite current major에서도 build해 브라우저 번들러 소비가 깨지지 않았는지 확인한다.

`./upload`은 signed upload authorization, provider transfer, completion을 조율하는 TypeScript runtime이다. provider URL은 ephemeral `Request` factory 내부에만 존재하며 package result나 error surface로 승격하지 않는다.

`createZdpClient()`와 generated request/response model은 public TypeScript surface다. generator script와 cross-repository handoff reader는 package export로 공개하지 않는다. API route와 required/optional field source of truth는 계속 `zdp-api-contracts`가 소유한다.

## 릴리스 경계

공개는 `main`에 포함된 exact version tag가 시작하는 GitHub Actions Trusted Publisher workflow만 사용한다. workflow는 release commit을 넣은 정확한 tarball을 먼저 빈 소비자에서 설치하고, 같은 파일을 npm에 publish한다. 공개 뒤에는 npm `gitHead`, integrity, registry signature, SLSA provenance, 빈 registry consumer와 GitHub Release 자산을 확인한다.

로컬 npm token publish, 이미 공개된 version 재사용, tag 이동, packed smoke와 다른 tarball publish는 금지한다. 실패 복구 기준은 `RUNBOOK.md`가 소유한다.
