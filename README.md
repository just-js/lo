```
                                  ⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
                                  ⬛⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬛
                                  ⬛⬜⬜⬜⬜⬛⬛⬜⬜⬜⬜⬜⬜⬜⬛⬜⬜⬜⬛⬛⬜⬛
                                  ⬛⬜⬜⬜⬛⬜⬜⬜⬜⬜⬜⬜⬜⬜⬛⬜⬜⬛⬜⬛⬜⬛
                                  ⬛⬜⬜⬛⬜⬜⬜⬛⬛⬜⬜⬜⬜⬜⬛⬛⬜⬛⬛⬜⬜⬛
                                  ⬛⬜⬛⬜⬜⬜⬛⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬛
                                  ⬛⬜⬛⬜⬜⬛⬜⬜⬜⬛⬛⬜⬜⬛⬛⬜⬜⬜⬜⬜⬜⬛
                                  ⬛⬜⬜⬜⬛⬜⬜⬜⬛⬜⬜⬜⬜⬜⬜⬛⬜⬜⬜⬜⬜⬛
                                  ⬛⬜⬜⬜⬛⬜⬜⬛⬜⬜⬜⬜⬜⬜⬜⬜⬛⬜⬜⬜⬜⬛
                                  ⬛⬜⬜⬜⬜⬜⬛⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬛⬜⬜⬜⬛
                                  ⬛⬜⬜⬜⬜⬜⬛⬜⬜⬜⬜⬜⬜⬛⬛⬜⬜⬛⬜⬜⬜⬛
                                  ⬛⬜⬜⬜⬜⬜⬛⬜⬜⬜⬜⬜⬛⬜⬜⬛⬜⬛⬜⬜⬜⬛
                                  ⬛⬜⬜⬜⬜⬜⬛⬜⬜⬜⬜⬜⬛⬜⬜⬛⬜⬛⬜⬜⬜⬛
                                  ⬛⬜⬜⬜⬜⬛⬜⬛⬜⬜⬜⬜⬜⬛⬛⬜⬛⬜⬛⬜⬜⬛
                                  ⬛⬜⬜⬜⬛⬜⬜⬜⬛⬜⬜⬜⬜⬜⬜⬛⬜⬜⬜⬛⬜⬛
                                  ⬛⬜⬜⬜⬛⬜⬜⬜⬜⬛⬛⬜⬜⬛⬛⬜⬜⬜⬜⬛⬜⬛
                                  ⬛⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬛
                                  ⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
```
```
                                👾 it's JavaScript Jim, but not as we know it. 👾
```



# prerequisites

## linux/macos

- gcc/g++ or clang/clang++
- make
- curl
- gunzip

## windows

# building

## linux

the default build of lo runtime links to system libssl and zlib but we build a 
custom version of libcurl as the default libcurl links to a ton of support 
libraries we don't need and this slows down startup time. we will likely remove 
dependency on libcurl at some point (i.e. when we have a robust implementation 
of fetch in the runtime) but, for now, you will need to install libcurl as 
follows.

```shell
sudo apt install -y libcurl4-openssl-dev libssl-dev zlib1g-dev
```

### gcc/x64
```
make lo
```

### arm64
```
make ARCH=arm64 lo
```

### clang
```
make CC="clang" CXX="clang++" lo
```

### ccache and mold for fast rebuilds
```
mold -run make C="ccache gcc" CC="ccache g++" lo
```

## macos

the default build of lo runtime depends on libcurl, which is available out
of the box on macos. it also depends on openssl, which does not seem to be 
available as a static library by default.

as such, you will need to install openssl using homebrew or some other 
mechanism for the default build to succeed.

```shell
brew install openssl@3
```

this will install libssl libs in /opt/homebrew/lib by default. if you need to 
override this default in the Makefile you can pass the LIB_DIRS argument to make
as follows

```shell
make LIB_DIRS=/opt/somewhere_else/lib ARCH=arm64 lo
```

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
