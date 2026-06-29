{
  "targets": [
    {
      "target_name": "lo",
      "sources": [
        "addon.cc",
        "../lo.cc",
        "../lib/core/core.cc",
        "../lib/boringssl/boringssl.cc",
        "../lib/ada/ada.cc",
        "../lib/curl/curl.cc",
        "../lib/heap/heap.cc",
        "../lib/md4c/md4c.cc",
        "../lib/python/python.cc",
        "../lib/luajit/luajit.cc",
        "builtins_addon.S"
      ],
      "cflags_cc": [
        "-O3",
        "-fPIC",
        "-march=native",
        "-mtune=native",
        "-Wcast-function-type",
        "-DRUNTIME=\"lo\"",
        "-DVERSION=\"0.0.23-pre\"",
      ],
      "ldflags": [
        "-O3",
        "-s"
      ],
      "include_dirs": [
        "./",
        "../",
        "../lib/boringssl/deps/boringssl/include",
        "../lib/ada/deps/ada-2.9.1/include",
        "../lib/curl/deps/curl/include",
        "../lib/md4c/deps/md4c/src",
        "../lib/luajit/deps/luajit",
      ],
      "libraries": [
        "../../lib/luajit/deps/luajit/src/libluajit.a",
      ],
      "link_settings": {
        "libraries": ["-lpython3.10"]
      }
    }
  ]
}
