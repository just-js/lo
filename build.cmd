REM "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
REM bun gen.js
clang-cl.exe /GS- -m64 /EHsc /std:c++20 /I. /I./v8 /I./v8/include /c -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS lib/win/win.cc
clang-cl.exe /GS- -m64 /EHsc /std:c++20 /I. /I./v8 /I./v8/include /c -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS lib/core2/core.cc
clang-cl.exe /GS- -m64 /EHsc /std:c++20 /I. /I./v8 /I./v8/include /c -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS -DVERSION=\"0.0.24-pre\" -DRUNTIME=\"lo\" lo.cc
clang-cl.exe /GS- -m64 /EHsc /std:c++20 /I. /I./v8 /I./v8/include /c -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS -DVERSION=\"0.0.24-pre\" -DRUNTIME=\"lo\" main.cc
clang-cl.exe v8\v8_monolith.lib lo.obj main.obj win.obj core.obj winmm.lib /link /machine:x64 /SUBSYSTEM:console /out:lo.exe /WHOLEARCHIVE /WX
