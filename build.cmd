@echo off
set VERSION=0.0.24-pre
set RUNTIME=lo
set V8_OPTS=-DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS
set OPTS=-std=c++20 -fomit-frame-pointer -fno-rtti -fno-exceptions -O3 -march=native -mtune=native
set WARN=-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter -Wno-error=unknown-warning-option
set OBJS=lo.o main.o win.o core.o inflate.o lib\inflate\em_inflate.o
set LOPTS=-lwinmm -ldbghelp -lbcrypt
set INCLUDE=-I. -I./v8 -I./v8/include
set BUILTINS=lib/inflate.js lib/gen.js lib/path.js lib/proc.js lib/stringify.js lib/binary.js
if "%WindowsSdkDir%"== "" (
  call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
)
if exist lo.exe (
  lo.exe gen --builtins --win main.js %BUILTINS% > builtins.h
  lo.exe gen lib\core2\api.js > lib\core2\core.cc
  lo.exe gen --header --win core.a win.a inflate.a %BUILTINS% > main_win.h
)
if not exist em_inflate.o (
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
clang++ %OPTS% %WARN% %INCLUDE% -c %V8_OPTS% -Ilib/inflate lib/inflate/inflate.cc
clang++ %OPTS% %WARN% %INCLUDE% -c %V8_OPTS% lib/win/win.cc
clang++ %OPTS% %WARN% %INCLUDE% -c %V8_OPTS% -D_CRT_SECURE_NO_WARNINGS lib/core2/core.cc
clang++ %OPTS% %WARN% %INCLUDE% -c %V8_OPTS% -DVERSION=\"%VERSION%\" -DRUNTIME=\"%RUNTIME%\" lo.cc
clang++ %OPTS% %WARN% %INCLUDE% -c %V8_OPTS% -DVERSION=\"%VERSION%\" -DRUNTIME=\"%RUNTIME%\" main.cc
REM clang++ %OPTS% %INCLUDE% -Iscratch\curl\curl-8.17.0_6-win64-mingw\include -c %V8_OPTS% -DNOMINMAX lib/curl/curl.cc
REM set CURLP=scratch\curl\curl-8.17.0_6-win64-mingw\
REM clang++ v8\v8_monolith.lib lo.o main.o win.o core.o inflate.o lib\inflate\em_inflate.o curl.o %CURLP%lib\libcurl.a %CURLP%lib\libcurl.dll.a -lwinmm -ldbghelp -lbcrypt -o lo.tmp.exe
clang++ v8\v8_monolith.lib %OBJS% %LOPTS% -o %RUNTIME%.tmp.exe
move /Y %RUNTIME%.tmp.exe %RUNTIME%.exe
del *.lib
del *.exp