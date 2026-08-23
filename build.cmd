@echo off
set VERSION=0.0.30-pre
set V8=14.9
set RUNTIME=lo
rem V8_COMPRESS_POINTERS must match repos/v8's own v8_enable_pointer_compression
rem (all 6 args.*.gn platform files) or V8::Initialize() hard-aborts with
rem "Embedder-vs-V8 build configuration mismatch" (real CI failure, run
rem 32610257944).
set V8_OPTS=-DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS -DV8_COMPRESS_POINTERS
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
rem Auto-detect the VS install via vswhere.exe (bundled with every VS
rem installer since 2017, always at this fixed path) rather than
rem hardcoding one edition/drive - was hardcoded to VS2026 Enterprise's
rem literal path here before, which broke for anyone on a different
rem edition (Community, Professional, BuildTools) or a different Program
rem Files root (BuildTools/Community sometimes land under the (x86) one).
rem -version "[18.0,19.0)" keeps the pin to VS2026 specifically (its
rem newer bundled clang-cl - VS2022's 19.1.5 is one version below what
rem the vendored libc++ headers require; 18 is VS2026's internal major
rem version, following VS2022's own 17.x scheme, confirmed against
rem GitHub's actions/runner-images issues, not guessed) rather than
rem silently falling back to an incompatible VS2022 if that's all a
rem given machine has - fails loudly instead, see below.
rem Two real, reproduced CI failures already came out of the
rem `for /f "usebackq" %%i in (`vswhere ...`)` backtick-execution form -
rem first from %ProgramFiles(x86)%'s own literal "(x86)" confusing the
rem for-loop's paren matching, then the *same* error again even after
rem moving that into its own plain `set` first (real evidence the
rem backtick-execution form itself is the fragile part here, not just
rem that one variable - not fully root-caused without a real Windows box
rem to test against, so replaced with a fundamentally simpler mechanism
rem instead of a third guess at the same construct). Redirecting
rem vswhere's own stdout to a plain temp file and reading that back with
rem `set /p` avoids backticks, nested quoting, and parenthesized-block
rem expansion entirely - each line here is a single flat command, no
rem structural parens involved at all.
if "%WindowsSdkDir%"== "" (
  call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
rem  call "C:\Program Files\Microsoft Visual Studio\18\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
)
rem vcvars64.bat above puts VS's own bundled clang-cl on PATH - not new
rem enough for whatever Clang-version floor V8's vendored libc++
rem currently requires (real, recurring: forced the VS2022->VS2026 CI
rem switch once already for the same reason, then broke again against
rem V8 14.9's "Libc++ only supports Clang 21 and later"). Must run AFTER
rem vcvars64.bat, not before - it prepends to PATH, so this needs to
rem come second to actually win. See V8-LIBCXX-CLANG-FLOOR.md in the
rem claude sandbox repo for the full writeup.
call install-llvm.cmd
rem set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
rem if "%WindowsSdkDir%"== "" (
rem   "%VSWHERE%" -latest -prerelease -products * -version "[18.0,19.0)" -property installationPath > "%TEMP%\vswhere-out.txt"
rem   set /p VSINSTALLPATH=<"%TEMP%\vswhere-out.txt"
rem   del "%TEMP%\vswhere-out.txt" >nul 2>&1
rem   if "%VSINSTALLPATH%"=="" (
rem     echo No Visual Studio 18.x ^(2026^) install found via vswhere - full listing follows for diagnosis:
rem     "%VSWHERE%" -prerelease -products *
rem     exit /b 1
rem   )
rem   if not exist "%VSINSTALLPATH%\VC\Auxiliary\Build\vcvars64.bat" (
rem     echo Found "%VSINSTALLPATH%" via vswhere but it has no VC\Auxiliary\Build\vcvars64.bat - C++ tools component missing?
rem     exit /b 1
rem   )
rem   call "%VSINSTALLPATH%\VC\Auxiliary\Build\vcvars64.bat"
rem )
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
clang++ v8\v8_monolith.lib %OBJS% %LOPTS% -o %RUNTIME%.tmp.exe
move /Y %RUNTIME%.tmp.exe %RUNTIME%.exe
del *.lib
del *.exp
