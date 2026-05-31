# zdp-client-sdks Runbook

This repository owns SDK surface contracts. It consumes API contracts and must not become the source of API truth.

## Normal Checks

- Run `bun run contracts:check` after SDK surface, auth helper, or upload client contract changes.
- Run `bun run check` before locking a TypeScript checker change.
- Validate this repository with `zdp-architecture-linter`.
- Keep `contracts/sdk-generation-source.yaml` pointed at `zdp-api-contracts/contracts/sdk-generation-input.yaml`.
- Keep `contracts/libs-export-source.yaml` pointed at the public `zdp-libs-ts` export surface.
- Keep SDK surface changes synchronized with `contracts/sdk-surface.yaml`.
- Require migration notes before breaking published SDK shapes.

## Failure Response

If API contract validation fails, freeze SDK generation and keep the last reviewed SDK surface.

If the local checker fails, fix the contract source first. Do not loosen the checker to allow API contract source ownership, refresh token storage, final authorization decisions, or raw provider upload URLs into SDK packages.

If SDK generation source validation fails, stop SDK refresh. The handoff contract exists so TypeScript, Dart, and Rust SDKs preserve the same route metadata, error identifiers, webhook replay rules, and forbidden sensitive values from `zdp-api-contracts` instead of each language inventing its own version.

If libs export source validation fails, stop SDK refresh. The handoff contract exists so generated SDKs reuse the same schema, env, event, error, and i18n export names from `zdp-libs-ts` without becoming the package source of truth or copying secrets into SDK fixtures.

## Manual Review Required

- SDK publish
- Auth helper behavior changes
- Breaking TypeScript, Dart, or Rust SDK surface changes
