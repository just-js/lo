# Builds bindings/lo.node against this box's musl Node + Alpine
# toolchain, with no node-gyp/npm/python3-for-node-gyp involved (see
# LO-BINDINGS.md for why). Environment-specific by design (hardcoded
# paths below), not a portable build system - meant to make a clean
# `repos/lo` checkout on *this* sandbox buildable with just `make`.
#
# CONFIG=core (default) - just the core module, zero external deps.
# CONFIG=lo - the full set (PLAN.md task 20 Phases 2-3): core,
#   boringssl, ada, curl, heap, md4c, python, luajit. `curl` links
#   against the system libcurl (lib/curl/api.js's own default when
#   CURL_STATIC isn't set to '1' - not a workaround, that's the
#   existing, current behavior of the checked-in api.js). `python`
#   likewise needs no build.js - just the system python3-dev package
#   (PYTHON_VERSION below, default 3.12) - see check-alpine-pkgs. The
#   other four (boringssl/ada/md4c/luajit) get fetched+built from
#   source via their own build.js, run through /root/lo (needs
#   lib/curl.js-backed fetch(), which plain `node` doesn't have) - see
#   build-*.js in this directory.
#
#   Usage: make CONFIG=lo clean addon test
#   (note: `make CONFIG=lo ...`, not `CONFIG=lo make ...` - the latter
#   is a shell env var that this Makefile's own `CONFIG := core`
#   assignment silently overrides; only a real `make` command-line
#   argument wins)
#
# Prerequisites this assumes are already on the box (all persistent
# under /root, see PERSISTENCE.md):
#   - Alpine musl toolchain at $(TC) (gcc/g++, fetch-alpine-toolchain.sh)
#   - musl Node 22 at $(NODE_DIR) (NODE.md)
#   - /root/lo (a working standalone `lo` binary, LO.md) - only needed
#     for CONFIG=lo, to run gen.js codegen and the build-*.js drivers
#   - Alpine packages beyond the base toolchain fetch - linux-headers
#     always; cmake, python3, curl-dev/libcurl+deps, openssl-dev
#     additionally for CONFIG=lo. See check-alpine-pkgs below and
#     ALPINE-PACKAGES.md/alpine-packages.log for what's already
#     installed and why.
#
# Known workarounds baked into this Makefile rather than into the
# (deliberately environment-agnostic, cross-platform) build.js scripts
# - see LO-BINDINGS.md's Phase 2 write-up for the full story:
#   - This box's toolchain isn't at the real system /usr, so every
#     compiler invocation needs --sysroot explicitly. build.js scripts
#     assume it's just found - CC/CXX/CFLAGS/CXXFLAGS below all carry
#     it, either via env (cmake respects env CFLAGS/CXXFLAGS at
#     configure time) or baked into CC/CXX itself (autotools/plain
#     exec() calls that override CFLAGS via env, like curl's and
#     luajit's build.js do, don't let an external CFLAGS override win -
#     but they don't touch CC/CXX, so sysroot goes there instead).
#   - md4c's and luajit's build.js each produce a non-PIC static lib by
#     default (md4c: static cmake pass omits
#     CMAKE_POSITION_INDEPENDENT_CODE; luajit: CFLAGS="-fPIC ..." is
#     set via environment, which LuaJIT's own Makefile can still
#     override internally) - both redone here with the flag forced via
#     a mechanism that actually wins (real cmake flag / real `make`
#     command-line variable).
#   - The prebuilt /root/lo binary's lo.os()/core.os return empty
#     strings (a bug in that specific stale build, predates the current
#     checkout - LO.md's "prebuilt binary vs. current source" gotcha).
#     curl/api.js's system-vs-static branch is gated on core.os ===
#     'linux', so build-ada.js/etc don't need this, but anything
#     touching that branch would - not currently needed since curl
#     doesn't get built from source in the default config.

TC := /root/demo/alpine-toolchain/root
NODE_DIR := /root/demo/node-v22.19.0-linux-x64-musl
ALPINE_PKG := /root/cloned/claude/alpine-pkg.sh
LO := /root/lo

CXX := g++
CONFIG := core

# python's own api.js reads this via lo.getenv('PYTHON_VERSION') too
# (defaults to 3.12 there as well if unset) - passed through explicitly
# here so `make PYTHON_VERSION=3.11 CONFIG=lo ...` regenerates python.cc
# and links consistently against the same version in one go.
PYTHON_VERSION := 3.12

ifeq ($(CONFIG),lo)
EXTRA_SRCS := ../lib/heap/heap.cc ../lib/boringssl/boringssl.cc ../lib/ada/ada.cc ../ada_cpp.o ../lib/curl/curl.cc ../lib/md4c/md4c.cc ../lib/python/python.cc ../lib/luajit/luajit.cc
EXTRA_INCLUDES := -I../deps/boringssl/include -I../deps/md4c/src -I../deps/luajit
EXTRA_OBJS := ../deps/boringssl/build/libssl.a ../deps/boringssl/build/libcrypto.a ../deps/md4c/build/src/libmd4c.a ../deps/md4c/build/src/libmd4c-html.a ../deps/luajit/src/libluajit.a
EXTRA_LIBS := -lcurl -lpython$(PYTHON_VERSION) -lpthread
DEPS := deps ../lib/python/python.cc
else
EXTRA_SRCS :=
EXTRA_INCLUDES :=
EXTRA_OBJS :=
EXTRA_LIBS :=
DEPS :=
endif

# -fvisibility=hidden is safe here: NODE_MODULE()'s registration is a
# __attribute__((constructor)) that *calls* node's own node_module_register()
# (an imported symbol lo.node depends on, resolved from the host node
# process at dlopen time - see LO-BINDINGS.md's ldd explanation) - it does
# not rely on node dlsym-ing any exported symbol *out of* lo.node by name.
# That well-known-symbol-lookup fallback (node_register_module_v<N>) only
# applies when NODE_MODULE() isn't used at all, per node.h's own comment.
CXXFLAGS := --sysroot=$(TC) -shared -fPIC -O3 -march=native -mtune=native -std=c++20 \
  -fvisibility=hidden \
  -DRUNTIME='"lo"' -DVERSION='"0.0.23-pre"' -D_LARGEFILE64_SOURCE \
  -I$(NODE_DIR)/include/node -I. -I.. $(EXTRA_INCLUDES)

# RELEASE=1 make clean addon - also strips the output (ld -s, matches
# binding.gyp's original ldflags). Left off by default since it removes
# symbols useful for debugging a fresh build.
ifdef RELEASE
CXXFLAGS += -s
endif

SRCS := addon.cc ../lo.cc ../lib/core/core.cc $(EXTRA_SRCS) builtins_addon.S

.PHONY: all addon release generate check-linux-headers check-alpine-pkgs deps test clean

all: addon

addon: lo.node

release:
	$(MAKE) RELEASE=1 addon

check-linux-headers:
	@test -f $(TC)/usr/include/linux/reboot.h || { \
	  echo "missing $(TC)/usr/include/linux/reboot.h - run:"; \
	  echo "  $(ALPINE_PKG) install linux-headers --reason 'repos/lo/bindings build'"; \
	  exit 1; \
	}

check-alpine-pkgs:
ifeq ($(CONFIG),lo)
	@test -x $(TC)/usr/bin/cmake || { echo "missing cmake - run: $(ALPINE_PKG) install cmake --reason 'repos/lo/bindings CONFIG=lo build'"; exit 1; }
	@test -x $(TC)/usr/bin/python3 || { echo "missing python3 - run: $(ALPINE_PKG) install python3 --reason 'ada build.js amalgamate.py'"; exit 1; }
	@test -f $(TC)/usr/include/curl/curl.h || { echo "missing curl-dev - run: $(ALPINE_PKG) install curl-dev libcurl --reason 'repos/lo/bindings CONFIG=lo build'"; exit 1; }
	@test -f $(TC)/usr/include/openssl/ssl.h || { echo "missing openssl-dev - run: $(ALPINE_PKG) install openssl-dev --reason 'lib/curl/build.js --with-openssl configure check'"; exit 1; }
	@test -f $(TC)/usr/include/python$(PYTHON_VERSION)/Python.h || { echo "missing python$(PYTHON_VERSION)-dev - run: $(ALPINE_PKG) install python3-dev --reason 'lib/python module headers/lib'"; exit 1; }
endif

v8-fast-api-calls.h:
	node pre.js

# addon.cc + builtins_addon.S are both generated by one gen-addon.js run;
# always regenerate rather than trying to make this a real file-target
# rule (avoids the classic make "multiple outputs from one recipe" trap)
generate: $(CONFIG).config.js gen-addon.js
	node gen-addon.js $(CONFIG)

../deps/boringssl/build/libssl.a ../deps/boringssl/build/libcrypto.a: build-boringssl.js ../lib/boringssl/build.js ../lib/boringssl/api.js
	cd .. && CFLAGS="--sysroot=$(TC)" CXXFLAGS="--sysroot=$(TC)" $(LO) bindings/build-boringssl.js

../deps/md4c/build/src/libmd4c.a ../deps/md4c/build/src/libmd4c-html.a: build-md4c.js ../lib/md4c/build.js ../lib/md4c/api.js
	cd .. && CFLAGS="--sysroot=$(TC)" CXXFLAGS="--sysroot=$(TC)" $(LO) bindings/build-md4c.js
	cd ../deps/md4c && CFLAGS="--sysroot=$(TC)" CXXFLAGS="--sysroot=$(TC)" cmake -DBUILD_SHARED_LIBS=OFF -DCMAKE_POSITION_INDEPENDENT_CODE=ON -B build
	$(MAKE) -C ../deps/md4c/build -j6

../deps/luajit/src/libluajit.a: build-luajit.js ../lib/luajit/build.js ../lib/luajit/api.js
	cd .. && CFLAGS="--sysroot=$(TC)" CXXFLAGS="--sysroot=$(TC)" $(LO) bindings/build-luajit.js
	$(MAKE) -C ../deps/luajit/src clean
	$(MAKE) -C ../deps/luajit/src -j4 BUILDMODE=static CC="gcc --sysroot=$(TC)" CFLAGS="-fPIC -O3 -march=native -mtune=native"

../ada_cpp.o: build-ada.js ../lib/ada/build.js ../lib/ada/api.js
	cd .. && $(LO) bindings/build-ada.js

# Codegen for every non-core module's .cc - none of these are checked
# in (only lib/core/core.cc and lib/curl/curl.cc are, per .gitignore's
# `lib/**/*.cc` + explicit exceptions - those two are the cross-platform
# "bootstrap" copies needed to build the base `lo` binary at all, before
# any codegen can run; everything else here is addon-only and always
# regenerated as part of this build, never committed).
../lib/heap/heap.cc: ../lib/heap/api.js gen-module.js
	cd .. && GEN_MODULE=heap $(LO) bindings/gen-module.js > lib/heap/heap.cc

../lib/boringssl/boringssl.cc: ../lib/boringssl/api.js gen-module.js
	cd .. && GEN_MODULE=boringssl $(LO) bindings/gen-module.js > lib/boringssl/boringssl.cc

../lib/ada/ada.cc: ../lib/ada/api.js gen-module.js
	cd .. && GEN_MODULE=ada $(LO) bindings/gen-module.js > lib/ada/ada.cc

../lib/md4c/md4c.cc: ../lib/md4c/api.js gen-module.js
	cd .. && GEN_MODULE=md4c $(LO) bindings/gen-module.js > lib/md4c/md4c.cc

../lib/luajit/luajit.cc: ../lib/luajit/api.js gen-module.js
	cd .. && GEN_MODULE=luajit $(LO) bindings/gen-module.js > lib/luajit/luajit.cc

# python needs no build.js - it's already on the box (python3/python3-dev
# packages, see ALPINE-PACKAGES.md) - only codegen, same as the above
../lib/python/python.cc: ../lib/python/api.js gen-module.js
	cd .. && GEN_MODULE=python PYTHON_VERSION=$(PYTHON_VERSION) $(LO) bindings/gen-module.js > lib/python/python.cc

deps: ../deps/boringssl/build/libssl.a ../deps/md4c/build/src/libmd4c.a ../deps/luajit/src/libluajit.a ../ada_cpp.o

GENERATED_CC := ../lib/heap/heap.cc ../lib/boringssl/boringssl.cc ../lib/ada/ada.cc ../lib/md4c/md4c.cc ../lib/luajit/luajit.cc ../lib/python/python.cc

lo.node: check-linux-headers check-alpine-pkgs v8-fast-api-calls.h generate $(DEPS) $(GENERATED_CC) ../lo.cc ../lo.h ../lib/core/core.cc
	$(CXX) $(CXXFLAGS) -o $@ $(SRCS) $(EXTRA_OBJS) $(EXTRA_LIBS)

core-test.so: core-test.c
	gcc --sysroot=$(TC) -shared -fPIC -o $@ $<

test: addon core-test.so
	node core-test.js

clean:
	rm -f lo.node addon.cc builtins_addon.S v8-fast-api-calls.h core-test.so
