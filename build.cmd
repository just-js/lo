@echo off
set VERSION=0.0.27-pre
set V8=14.6
set RUNTIME=lo
set V8_OPTS=-DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS
rem libc++'s __config_site deliberately doesn't set this - its own
rem comment says so: "_LIBCPP_HARDENING_MODE_DEFAULT is not defined
rem here. Instead, we define _LIBCPP_HARDENING_MODE in
rem build/config/compiler/BUILD.gn" - a plain -D flag Chromium's build
rem system supplies automatically that this script needs to replicate.
rem Real CI failure ("_LIBCPP_HARDENING_MODE_DEFAULT is not defined"),
rem not reasoned through ahead of time. NONE (no extra runtime checks)
rem rather than Chromium's own gated default, which wasn't pinned down -
rem matches lo's own close-to-the-metal style anyway.
rem Chromium's own runtime_library GN config
rem (build/config/c++/BUILD.gn): "if (!libcxx_is_shared) { # Don't leak
rem any symbols on a static build. defines +=
rem [ '_LIBCPP_DISABLE_VISIBILITY_ANNOTATIONS' ] }" - v8_monolith.lib is
rem a fully static archive (is_component_build=false in args.win.x64.gn,
rem so libcxx_is_shared is false there too), so its own code was
rem compiled with this define, expecting plain static symbol linkage.
rem Without it here too, this file's own .cc compiles instead default
rem to __declspec(dllimport)-decorated symbol references (assuming a
rem libc++.dll that doesn't exist), which don't match what's actually in
rem v8_monolith.lib - real LNK2019 "unresolved external symbol
rem __declspec(dllimport) ... std::__Cr::basic_string<...>::__init"
rem errors, not reasoned through ahead of time.
set OPTS=-std=c++20 -fomit-frame-pointer -fno-rtti -fno-exceptions -O3 -march=native -mtune=native -D_LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_NONE -D_LIBCPP_DISABLE_VISIBILITY_ANNOTATIONS
rem -Wno-error=unused-command-line-argument stays as a safety margin -
rem originally added because -stdlib=libc++ triggered "argument unused
rem during compilation" on clang-cl's compile-only (-c) invocations
rem (explicit -I paths already supply the headers, INCS below, so the
rem flag had nothing left to do there) - real CI failure under -Werror,
rem not reasoned through ahead of time. -stdlib=libc++ itself is no
rem longer passed on the -c lines below (removed - it was a genuine
rem no-op there, confirmed by the compiler's own warning, not just
rem cosmetic), only on the link line, where it's not a no-op - see the
rem comment there.
set WARN=-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter -Wno-error=unknown-warning-option -Wno-error=unused-command-line-argument
set OBJS=lo.o main.o win.o core.o inflate.o lib\inflate\em_inflate.o
rem libc++'s exception_ptr implementation on Windows calls through to
rem a handful of MSVC-runtime-provided ABI helpers
rem (__ExceptionPtrCreate/__ExceptionPtrCopy/etc, in libcpmt.lib for a
rem static/non-component build) - this is a real, currently open
rem upstream libc++ gap (llvm/llvm-project#84490, "Static libc++ on
rem Windows has problems with missing exception related symbols"), not
rem something specific to this build. Chromium hits the exact same gap
rem and papers over it with one explicit linker directive - confirmed
rem directly in build/config/win/BUILD.gn's static_crt config: "On
rem Windows, including libcpmt[d]/msvcprt[d] explicitly links the C++
rem standard library, which libc++ needs for exception_ptr internals."
rem /MT (static CRT, matching is_component_build=false in
rem args.win.x64.gn) pairs with libcpmt.lib specifically - msvcprt.lib
rem is the /MD (dynamic CRT / component build) variant, not this one.
set LOPTS=-lwinmm -ldbghelp -lbcrypt -Xlinker /DEFAULTLIB:libcpmt.lib
rem was named INCLUDE, which collided with the real system INCLUDE env
rem var vcvars64.bat sets below (MSVC STL + Windows SDK header search
rem paths, semicolon-separated) - this batch-style "-I ..." string
rem silently clobbered it, breaking header resolution even when
rem vcvars64.bat ran successfully. renamed to avoid the collision.
set INCS=-I. -I./v8 -I./v8/include -I./v8/third_party/libc++/src/include -I./v8/buildtools/third_party/libc++
set BUILTINS=lib/inflate.js lib/gen.js lib/path.js lib/proc.js lib/stringify.js lib/binary.js
rem hardcoded to VS2026 Enterprise's real path - trying VS2026 for its
rem newer bundled clang-cl (VS2022's 19.1.5 is one version below what
rem the vendored libc++ headers require). VS2026 installs under
rem "...\18\Enterprise", not "...\2026\Enterprise" - 18 is its internal
rem major version number (following VS2022's own 17.x scheme),
rem confirmed against GitHub's actions/runner-images issues, not
rem guessed. Only works pinned to the windows-2025 runner label (VS2026
rem GA there since 2026-05-07) - see .github/workflows/build.yml.
if "%WindowsSdkDir%"== "" (
  call "C:\Program Files\Microsoft Visual Studio\18\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
)
if not exist v8 (
  mkdir v8
  cd v8
  curl -L -O https://github.com/just-js/v8/releases/download/%V8%/include.tar.gz
  tar -xvf include.tar.gz
  curl -L -O https://github.com/just-js/v8/releases/download/%V8%/libv8_monolith-win-x64.zip
  tar -xvf libv8_monolith-win-x64.zip
  rem headers for the vendored libc++ v8_monolith.lib was actually built
  rem against (use_custom_libcxx=true, see args.win.x64.gn) - not MSVC's
  rem own STL. Published by just-js/v8 alongside the monolith/headers,
  rem same release. Extracts to third_party/libc++/src/include and
  rem buildtools/third_party/libc++/{__config_site,__assertion_handler} -
  rem the same relative layout Chromium's own build/config/c++/BUILD.gn
  rem uses, matched below in INCS. See C++.md entry 2.
  curl -L -O https://github.com/just-js/v8/releases/download/%V8%/libcxx-headers-win-x64.zip
  tar -xvf libcxx-headers-win-x64.zip
  del /Q *.zip
  del /Q *.gz
  cd ..
)
if exist lo.exe (
  lo.exe gen --builtins --win main.js %BUILTINS% > builtins.h
  lo.exe gen lib\core2\api.js > lib\core2\core.cc
  lo.exe gen --header --win core.a win.a inflate.a %BUILTINS% > main_win.h
)
if not exist lib\inflate\em_inflate.o (
  cd lib\inflate
  if not exist em_inflate.h (
    curl -s -O https://raw.githubusercontent.com/emmanuel-marty/em_inflate/master/lib/em_inflate.h
  )
  if not exist em_inflate.c (
    curl -s -O https://raw.githubusercontent.com/emmanuel-marty/em_inflate/master/lib/em_inflate.c
  )
  clang -I. -c -o em_inflate.o -O3 em_inflate.c
  cd ..\..
)
rem v8_monolith.lib is built with use_custom_libcxx=true (see
rem ../v8/args.win.x64.gn - MSVC's own STL is an unsupported config for
rem building V8 with clang-cl on Windows) - -stdlib=libc++ here to match,
rem same rule as always: both sides of a link need to agree on which C++
rem standard library built them, see ../../C++.md. Headers come from the
rem libcxx-headers-win-x64.zip download above (INCS); no separate
rem libc++.lib to link against - Chromium builds libc++ as a GN
rem source_set on Windows (not static_library, unlike Linux/macOS), so
rem its compiled object code is already folded directly into
rem v8_monolith.lib itself.
clang++ %OPTS% %WARN% %INCS% -c %V8_OPTS% lib/win/win.cc
clang++ %OPTS% %WARN% %INCS% -c %V8_OPTS% -Ilib/inflate lib/inflate/inflate.cc
clang++ %OPTS% %WARN% %INCS% -c %V8_OPTS% -D_CRT_SECURE_NO_WARNINGS lib/core2/core.cc
clang++ %OPTS% %WARN% %INCS% -c %V8_OPTS% -DVERSION=\"%VERSION%\" -DRUNTIME=\"%RUNTIME%\" lo.cc
clang++ %OPTS% %WARN% %INCS% -c %V8_OPTS% -DVERSION=\"%VERSION%\" -DRUNTIME=\"%RUNTIME%\" main.cc
REM set CURLP=scratch\curl\curl-8.17.0_6-win64-mingw\
REM clang++ %OPTS% %INCS% -I%CURLP%include -c %V8_OPTS% -DNOMINMAX lib/curl/curl.cc
REM clang++ v8\v8_monolith.lib %OBJS% curl.o -L %CURLP%lib -l libcurl -l libcurl.dll -l libbrotlicommon -l libbrotlidec -l libcrypto -l libnghttp2 -l libnghttp3 -l libngtcp2 -l libngtcp2_crypto_libressl -l libpsl -l libssh2 -l libz -l libzstd %LOPTS% -o lo.tmp.exe
rem -stdlib=libc++ stays here (link step only) - this is where it's not
rem a no-op, unlike the -c lines above: it's what actually selects
rem libc++'s runtime/ABI over MSVC's own STL when linking against
rem v8_monolith.lib. Removing it here would very likely reintroduce the
rem original MSVC-STL-vs-libc++ mismatch this whole file's libc++
rem workarounds exist to solve.
clang++ -stdlib=libc++ v8\v8_monolith.lib %OBJS% %LOPTS% -o %RUNTIME%.tmp.exe
move /Y %RUNTIME%.tmp.exe %RUNTIME%.exe
del *.lib
del *.exp
