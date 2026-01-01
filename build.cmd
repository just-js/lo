@echo off
set VERSION=0.0.24-pre
set RUNTIME=lo
set BUILTINS=lib/inflate.js lib/gen.js lib/path.js lib/proc.js lib/stringify.js lib/binary.js
if "%WindowsSdkDir%"== "" (
  call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
)
if exist lo.exe (
  lo.exe gen --builtins --win main.js %BUILTINS% > builtins.h
  lo.exe gen lib\core2\api.js > lib\core2\core.cc
  lo.exe gen --header --win core.a win.a inflate.a %BUILTINS% > main_win.h
)
clang-cl.exe /GS- -m64 /EHsc /std:c++20 /I. /I./v8 /I./v8/include /c -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS lib/win/win.cc
clang-cl.exe /GS- -m64 /EHsc /std:c++20 /I. /I./v8 /I./v8/include /c -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS -D_CRT_SECURE_NO_WARNINGS lib/core2/core.cc
cd lib\inflate
curl -s -O https://raw.githubusercontent.com/emmanuel-marty/em_inflate/master/lib/em_inflate.h
curl -s -O https://raw.githubusercontent.com/emmanuel-marty/em_inflate/master/lib/em_inflate.c
clang -I. -c -o em_inflate.o -O3 em_inflate.c
cd ..\..
clang-cl.exe /GS- -m64 /EHsc /std:c++20 /I. /I./lib/inflate /I./v8 /I./v8/include /c -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS lib/inflate/inflate.cc
clang-cl.exe /GS- -m64 /EHsc /std:c++20 /I. /I./v8 /I./v8/include /c -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS -DVERSION=\"%VERSION%\" -DRUNTIME=\"%RUNTIME%\" lo.cc
clang-cl.exe /GS- -m64 /EHsc /std:c++20 /I. /I./v8 /I./v8/include /c -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS -DVERSION=\"%VERSION%\" -DRUNTIME=\"%RUNTIME%\" main.cc
clang-cl.exe v8\v8_monolith.lib lo.obj main.obj win.obj core.obj inflate.obj lib\inflate\em_inflate.o winmm.lib /link /machine:x64 /SUBSYSTEM:console /out:lo.exe /WHOLEARCHIVE /WX
