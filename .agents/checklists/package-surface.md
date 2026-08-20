# Package Surface Checklist

- Root, `./typed-fetch`, and `./typed-fetch/api-operations` are the only public exports.
- Runtime exports resolve to compiled `dist/**/*.js` and type exports resolve to matching `dist/**/*.d.ts`.
- `files` includes `dist/` and excludes `src/`, tests, checker implementations, and generated language-specific runtime artifacts.
- Packed consumers pass Node and Bun direct ESM imports plus TypeScript `NodeNext` declaration resolution.
- CI builds the packed package in the current Vite major.
- Package examples do not use live base URLs or real tokens.
- Package metadata changes are paired with version impact review.
- Pack evidence is collected before publish work.
- The release tag is exactly `v<package.json version>` and points to a commit contained in `main`.
- The release workflow uses npm Trusted Publisher OIDC and contains no npm token secret path.
- The smoke-tested tarball, npm `gitHead`, npm integrity, provenance, and GitHub Release assets describe the same bytes and commit.
