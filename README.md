# prerequisites

## linux/macos

- gcc/g++ or clang/clang++
- make
- curl
- gunzip

## windows

# building

## linux

### gcc/x64
```
make cleanall lo
```

### arm64
```
make ARCH=arm64 cleanall lo
```

### clang
```
make C="clang" CC="clang++" clean lo
```

### ccache and mold for fast rebuilds
```
mold -run make C="ccache gcc" CC="ccache g++" lo
```

## macos

### x64
```
make cleanall lo
```

### arm64
```
make ARCH=arm64 cleanall lo
```

## windows

- install chocolatey
run in powershell terminal as administrator

```
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

- install make
```
choco install make
```

- install visual studio or msbuild
- open an 'x64 Native Tools' command prompt as described [here](https://learn.microsoft.com/en-us/cpp/build/how-to-enable-a-64-bit-visual-cpp-toolset-on-the-command-line?view=msvc-170)

```
make cleanall lo.exe test
```

```Powershell
PS C:\Users\User\Documents\source\lo> make clean lo.exe test
cl /EHsc /std:c++17 /DGLOBALOBJ='"lo"' /DVERSION='"0.0.1"' /I. /I./v8 /I./v8/include /c main.cc
Microsoft (R) C/C++ Optimizing Compiler Version 19.37.32825 for x64
Copyright (C) Microsoft Corporation.  All rights reserved.

main.cc
cl /EHsc /std:c++17 /DGLOBALOBJ='"lo"' /DVERSION='"0.0.1"' /I. /I./v8 /I./v8/include /c spin.cc
Microsoft (R) C/C++ Optimizing Compiler Version 19.37.32825 for x64
Copyright (C) Microsoft Corporation.  All rights reserved.

spin.cc
link /out:lo.exe v8/v8_monolith.lib spin.obj main.obj winmm.lib dbghelp.lib advapi32.lib
Microsoft (R) Incremental Linker Version 14.37.32825.0
Copyright (C) Microsoft Corporation.  All rights reserved.

   Creating library lo.lib and object lo.exp
./lo
lo 0.0.1
v8 12.0.267.3
```