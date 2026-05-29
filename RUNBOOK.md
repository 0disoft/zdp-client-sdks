# zdp-client-sdks Runbook

This repository owns SDK surface contracts. It consumes API contracts and must not become the source of API truth.

## Normal Checks

- Validate this repository with `zdp-architecture-linter`.
- Keep SDK surface changes synchronized with `contracts/sdk-surface.yaml`.
- Require migration notes before breaking published SDK shapes.

## Failure Response

If API contract validation fails, freeze SDK generation and keep the last reviewed SDK surface.

## Manual Review Required

- SDK publish
- Auth helper behavior changes
- Breaking TypeScript, Dart, or Rust SDK surface changes
