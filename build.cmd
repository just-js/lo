@echo off
set VERSION=0.0.24-pre
set V8=14.4
set RUNTIME=lo
set V8_OPTS=-DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS
set OPTS=-std=c++20 -fomit-frame-pointer -fno-rtti -fno-exceptions -O3 -march=native -mtune=native
rem -stdlib=libc++ triggers "argument unused during compilation" on
rem clang-cl's compile-only (-c) invocations once explicit -I paths
rem already supply the headers (INCS below) - benign (the link step's
rem own -stdlib=libc++ is what actually matters for stdlib selection),
rem but -Werror turns it fatal without this. Real CI failure, not
rem reasoned through ahead of time.
set WARN=-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter -Wno-error=unknown-warning-option -Wno-error=unused-command-line-argument
set OBJS=lo.o main.o win.o core.o inflate.o lib\inflate\em_inflate.o
set LOPTS=-lwinmm -ldbghelp -lbcrypt
rem was named INCLUDE, which collided with the real system INCLUDE env
rem var vcvars64.bat sets below (MSVC STL + Windows SDK header search
rem paths, semicolon-separated) - this batch-style "-I ..." string
rem silently clobbered it, breaking header resolution even when
rem vcvars64.bat ran successfully. renamed to avoid the collision.
set INCS=-I. -I./v8 -I./v8/include -I./v8/third_party/libc++/src/include -I./v8/buildtools/third_party/libc++
set BUILTINS=lib/inflate.js lib/gen.js lib/path.js lib/proc.js lib/stringify.js lib/binary.js
rem hardcoded to VS2022 Enterprise's real path (confirmed against
rem GitHub's own runner-images docs) - windows-latest now points at
rem Windows Server 2025 (ships VS2026, different path/version entirely),
rem so this only works pinned to the windows-2022 runner label, see
rem .github/workflows/build.yml
if "%WindowsSdkDir%"== "" (
  call "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
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
clang++ %OPTS% %WARN% %INCS% -stdlib=libc++ -c %V8_OPTS% lib/win/win.cc
clang++ %OPTS% %WARN% %INCS% -stdlib=libc++ -c %V8_OPTS% -Ilib/inflate lib/inflate/inflate.cc
clang++ %OPTS% %WARN% %INCS% -stdlib=libc++ -c %V8_OPTS% -D_CRT_SECURE_NO_WARNINGS lib/core2/core.cc
clang++ %OPTS% %WARN% %INCS% -stdlib=libc++ -c %V8_OPTS% -DVERSION=\"%VERSION%\" -DRUNTIME=\"%RUNTIME%\" lo.cc
clang++ %OPTS% %WARN% %INCS% -stdlib=libc++ -c %V8_OPTS% -DVERSION=\"%VERSION%\" -DRUNTIME=\"%RUNTIME%\" main.cc
REM set CURLP=scratch\curl\curl-8.17.0_6-win64-mingw\
REM clang++ %OPTS% %INCS% -stdlib=libc++ -I%CURLP%include -c %V8_OPTS% -DNOMINMAX lib/curl/curl.cc
REM clang++ v8\v8_monolith.lib %OBJS% curl.o -L %CURLP%lib -l libcurl -l libcurl.dll -l libbrotlicommon -l libbrotlidec -l libcrypto -l libnghttp2 -l libnghttp3 -l libngtcp2 -l libngtcp2_crypto_libressl -l libpsl -l libssh2 -l libz -l libzstd %LOPTS% -o lo.tmp.exe
clang++ -stdlib=libc++ v8\v8_monolith.lib %OBJS% %LOPTS% -o %RUNTIME%.tmp.exe
move /Y %RUNTIME%.tmp.exe %RUNTIME%.exe
del *.lib
del *.exp
