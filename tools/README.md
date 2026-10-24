# `tools/` — release tooling

Node ESM scripts (no dependencies, Node 20+), so releasing doesn't need a
lo built against the new V8 first. They take a GitHub token from
`$GH_TOKEN` or `$GITHUB_TOKEN`, and get the repo from the `origin` remote.

- **[`release.js`](release.js)** - releases lo for a V8 version:
  1. checks the just-js/v8 release for that version has every asset lo
     downloads (`include.tar.gz`, `src.tar.gz`, the four
     `libv8_monolith-*.a.gz`, `libv8_monolith-win-x64.zip`,
     `libcxx-headers-win-x64.zip`), so it can't run before V8 is built
  2. on `main`, sets `VERSION`/`V8_VERSION` in `Makefile` and
     `VERSION`/`V8` in `build.cmd` (keeping its CRLF line endings), and
     commits only those two files as `chore: v8 <v8-version>`; skipped if
     `main` already has those values
  3. tags the commit `<lo-version>` and pushes `main` and the tag in one
     atomic push
  4. with `--release`, publishes the GitHub prerelease (`- V8 Version X`
     plus the changelog link from the previous version tag), which starts
     `release.yml`

  It refuses unless you're on `main`, level with `origin/main`, with no
  local changes to `Makefile`/`build.cmd` and nothing staged. Untracked
  and other modified files are never added. If the push succeeds but
  publishing fails, re-run the same command: with the tag already on
  `origin` at matching versions, it only publishes. `--release` needs a
  token with Contents: Read and write. `--dry-run` does every check and
  prints what it would do, changing nothing.

  With `--release` the release build is the only build: the bump commit
  says `[skip ci]`, so the pushes start no `push.yml` runs, and any push
  runs for the tagged commit that start anyway are cancelled after
  publishing (they would build the same commit again).
  ```
  node tools/release.js --release --dry-run 0.0.36-pre 15.5
  node tools/release.js --release 0.0.36-pre 15.5
  ```

The V8 side (tagging and publishing just-js/v8 releases, bumping
`V8_VERSION`, watching a CI run) is in just-js/v8's `tools/`
(`release.js`, `bump.js`, `watch-run.js`).
