# building spin

## clone the experimental branch of the repository 
```
git clone -b experimental --single-branch git@github.com:just-js/lo.git
cd lo
```

## view the help for make commands
```
make help
```

## download and extract the prebuild v8 static library
```
make deps
```

## build the libraries the main runtime depends on
```
make stdlibs
```

## build the runtime
```
make spin
```
