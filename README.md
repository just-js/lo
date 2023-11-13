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
make C="clang" CC="clang++ clean lo
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
