# The Book of Lo

Welcome to lo - an experimental JavaScript runtime which does things a little
differently.

# Introduction

## Chapter 1 - Getting Started

## download the lo runtime

First we need to download the latest release of the lo runtime. We assume you
have curl installed but you can use wget or any other method to download the 
gzip compressed binary from github.

on linux/x64

```shell
curl -L -o lo.gz https://github.com/just-js/lo/releases/download/0.0.14-pre/lo-linux-x64.gz
```

on linux/arm64

```shell
curl -L -o lo.gz https://github.com/just-js/lo/releases/download/0.0.14-pre/lo-linux-arm64.gz
```

on macos/x64

```shell
curl -L -o lo.gz https://github.com/just-js/lo/releases/download/0.0.14-pre/lo-mac-x64.gz
```

on macos/arm64 (apple silicon)

```shell
curl -L -o lo.gz https://github.com/just-js/lo/releases/download/0.0.14-pre/lo-mac-arm64.gz
```

Then, we need to decompress the downloaded file and make it executable

```shell
gunzip lo.gz && chmod +x lo
```

Now, before we run, let's see if the libraries lo depends on can be found

on linux

```shell
ldd ./lo

        linux-vdso.so.1 (0x00007ffc51b8a000)
        libssl.so.3 => /lib/x86_64-linux-gnu/libssl.so.3 (0x0000731982a59000)
        libcrypto.so.3 => /lib/x86_64-linux-gnu/libcrypto.so.3 (0x000073197fc00000)
        libz.so.1 => /lib/x86_64-linux-gnu/libz.so.1 (0x0000731982a3d000)
        libm.so.6 => /lib/x86_64-linux-gnu/libm.so.6 (0x0000731980119000)
        libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x000073197f800000)
        /lib64/ld-linux-x86-64.so.2 (0x0000731982b11000)
```

by default, lo statically links libgcc and libstdc++ and has a runtime dependency
on system libz and libssl. libcurl is statically linked into the runtime so you
do not need libcurl4 available in order for lo to be able to download from the web.

at some point, we will remove this dependency on libcurl in favour of natively
downloading/fetching over http(s). bear in mind that any calls to curl are
synchronous currently and will block the event loop until we have a native non-blocking
http client implemented.

you will also need system root certificates installed for libcurl to work. 

all of these dependencies should be installed by default on any mainstream 
linux distro but if they are not available or you are building a docker/container
for lo, you can install the dependencies as follows on a debian/apt based system

```shell
apt install -y libz libssl3 ca-certificates
```

on macos

```shell
otool -L ./lo

	/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1345.100.2)
	/usr/lib/libcurl.4.dylib (compatibility version 7.0.0, current version 9.0.0)
	/opt/homebrew/opt/openssl@3/lib/libssl.3.dylib (compatibility version 3.0.0, current version 3.0.0)
	/opt/homebrew/opt/openssl@3/lib/libcrypto.3.dylib (compatibility version 3.0.0, current version 3.0.0)
	/usr/lib/libc++.1.dylib (compatibility version 1.0.0, current version 1700.255.0)

```

on macos, by default lo dynamically links against libc++ and libcurl. these should
be available by default on macos. you will need to install openssl using homebrew as follows if it
is not already installed.

```shell
brew install openssl@3
```

### testing lo runtime

Okay, now we should be able to run lo. let's run with no arguments and see the
help

```shell
./lo



```

let's check the version number of lo and the embedded JS engine it is using

```shell
./lo --version

lo 0.0.14-pre
v8 12.3.219.12
```

### evaluating JavaScript

let's get lo to evaluate some javascript for us

```shell
./lo eval "console.log('hello')"
```

we can also use await with eval

```shell
./lo eval "console.log((await import('lib/binary.js')).dump((new TextEncoder()).encode('hello')))"
```

### invoking the lo REPL

lo has a very basic repl which you can invoke as follows

```shell
./lo repl


 lo    0.0.14-pre        v8    12.3.219.12
 arch  x64               os    linux
 boot  5.94 ms           rss   23068672

> 
```

if you want to read more about the repl, check out the [docs](). for now, let's
run some code inside the repl to inspect what is inside the default lo runtime
we downloaded.

```shell
> lo

{
  version: {
    lo: "0.0.14-pre",
    v8: "12.3.219.12"
  },
...
}
```

this will dump the contents of the "lo" object which is in the global namespace. lo does not add any other fields to the global namespace other than this.

### inspect the runtime builtins and bindings

let's have a look at what javascript modules and static assets are embedded in the lo runtime.


```shell
> lo.builtins()

[
  "globals.d.ts",
  "lib/ansi.js",
  "lib/asm.js",
  ...
]
```

and let's see what bindings are available

```shell
> lo.bindings()

[
  "bestlines",
  "core",
  "curl",
  "encode",
  "epoll",
  "inflate",
  "libssl",
  "net",
  "pico",
  "pthread",
  "sqlite",
  "system"
]
```

you can learn more about the available modules [here]() and bindings [here](), how to embed assets [here]() and how to build your own runtimes with different defailt builtins and bindings [here]().

Okay, we have successfully downloaded the lo runtime and verified it seems to be working correctly - let's move on to doing some more interesting things.


First, let's "install" lo so it is avalable system wide.

you can give the install command an explicit path to install to

```shell
./lo install $HOME
```

and lo will copy itself into that directory

or, if you don't pass any path

```shell
./lo install
```

lo will read the $HOME environment variable and install itself at $HOME/.lo/bin/lo


let's create a new project. we can do this in the current directory with

```shell
lo init
```

and it will create a project with the same name as the current directory

or, specify a path and lo will create that directory and create a project in it
with the name of the last directory in the path. if you omit a leading slash
in the path name then lo will create the directory relative to the current one.

```shell
lo init foo
```

after you create the project you should see these files in the project 
directory, assuming the name of the project is 'foo'

- foo.js: the main script
- foo.config.js: a config file for building the project into an executable
- .gitignore: a gitignore that will ignore any build artifacts that should not be checked in




if you pass a ```--types``` flag to the lo init command, it will add typescript
definitions to the project folder

- globals.d.ts

if you pass a ```--js-config``` flag to the lo init command, it will add a 
jsconfig.json file to the project folder



let's edit ```foo.js``` and make it do something useful

```JavaScript
import { mem } from 'lib/proc.js'

console.log(mem())
```

this little program will import the mem() function from the proc module which 
is part of the lo standard library. these modules are maintained in the
lo repo under the lib folder. when the standard release of lo is built, it will
embed a number of these modules into the binary so they are loaded from memory
at run time.

lo module resolution currently will only load from a fully specified path or, if
a relative path is specified, it will always try to load relative to the current
working directory. if the path matches the path of a module that is embedded in the
runtime, then that module will be loaded from memory.

if you want to force loading a local module in the filesystem over one that is embedded in the runtime, you can set the LO_CACHE=1 environment variable to force always

