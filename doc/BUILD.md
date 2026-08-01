# Build notes

Notes on non-obvious parts of the build. See [`README.md`](../README.md) for
the actual build steps.

## macOS: why we link `-framework CoreFoundation`

The [`Makefile`](../Makefile) links `-framework CoreFoundation` on macOS
(`LARGS+=-s -w -framework CoreFoundation`). None of `lo`'s own code needs
it — `core.o`, `mach.o`, `kevents.o`, `lo.o`, `main.o`, `curl.o` and
`system.o` have no references to any `CF*` symbol.

The dependency comes from inside the prebuilt `v8/libv8_monolith.a` we
download from [`just-js/v8` releases](https://github.com/just-js/v8/releases).
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
timezone name for `Intl`/`Date`. Since we consume V8 as a prebuilt static
archive rather than building it from source, that reference is baked in —
it's not something a `Makefile` flag can strip.

Practically this is a non-issue: CoreFoundation is a system framework
present on every macOS install, so linking it costs nothing at install/build
time (unlike `libcurl`/`libssl`, which do need to be present separately).
Removing it would require rebuilding that V8 release without i18n/ICU
support (`v8_enable_i18n_support=false`) or patching
`platform-darwin.cc` to get the timezone another way (e.g. `readlink
/etc/localtime`), and publishing a new `just-js/v8` release binary — not
something fixable from this repo's `Makefile` alone.
