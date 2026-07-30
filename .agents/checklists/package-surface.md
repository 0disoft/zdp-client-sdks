# Package Surface Checklist

- Root, `./typed-fetch`, and `./typed-fetch/api-operations` are the only public exports.
- `files` allowlist does not include generated language-specific runtime artifacts.
- Package examples do not use live base URLs or real tokens.
- Package metadata changes are paired with version impact review.
- Pack evidence is collected before publish work.
- The release tag is exactly `v<package.json version>` and points to a commit contained in `main`.
- The release workflow uses npm Trusted Publisher OIDC and contains no npm token secret path.
- The smoke-tested tarball, npm `gitHead`, npm integrity, provenance, and GitHub Release assets describe the same bytes and commit.
