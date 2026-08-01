# Build notes

Notes on non-obvious parts of the build. See [`README.md`](../README.md) for
the actual build steps.

## macOS: why we link `-framework CoreFoundation`

The [`Makefile`](../Makefile) links `-framework CoreFoundation` on macOS
(`LARGS+=-s -w -framework CoreFoundation`). None of `lo`'s own code needs
it — `core.o`, `mach.o`, `kevents.o`, `lo.o`, `main.o`, `curl.o` and
`system.o` have no references to any `CF*` symbol.

The dependency comes from inside the prebuilt `v8/libv8_monolith.a` we
currently download from
[`just-js/v8` releases](https://github.com/just-js/v8/releases) for build
speed — that release is built by us, it's just not built from source as
part of this repo's own build today.
`nm -u v8/libv8_monolith.a | grep '^_CF'` shows:

```
_CFRelease
_CFStringGetCString
_CFStringGetLength
_CFStringGetMaximumSizeForEncoding
_CFTimeZoneCopyDefault
_CFTimeZoneGetName
```

These come from V8's `src/base/platform/platform-darwin.cc`, which uses
`CFTimeZoneCopyDefault`/`CFTimeZoneGetName` to look up the host's local
timezone name for `Intl`/`Date`. As currently consumed — a prebuilt static
archive fetched at build time — that reference is baked in and not
something a `Makefile` flag on *this* repo can strip.

Practically this is a non-issue day to day: CoreFoundation is a system
framework present on every macOS install, so linking it costs nothing at
install/build time (unlike `libcurl`/`libssl`, which do need to be present
separately).

**Update**: a fully local V8 build (compiling V8 from source with our own
GN args, replacing the "download a release" step above) is in progress. At
that point this does become fixable from our own build config — either
`v8_enable_i18n_support=false` (if `lo` doesn't need locale-aware
`Intl`/ICU behavior) or patching `platform-darwin.cc` to get the timezone
another way (e.g. `readlink /etc/localtime`) — since we'd control the V8
build itself rather than consuming someone else's compiled release. See
[`PROPOSAL.md`](PROPOSAL.md#v8-build-control-changes-the-assessment) for
the fuller picture of what else that unlocks (symbol visibility, dead-code
stripping, other V8 feature flags).
