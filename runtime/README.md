# runtime

this directory holds configurations for different runtimes.

the following configurations exist:

## core.config.js

a minimal runtime with only the core binding and no modules

to build the runtime:

```shell
lo build runtime runtime/core
```

## base.config.js

the base runtime we build initially which allows us to build other runtimes. it
packages the core, curl and inflate bindings which are used by build scripts.

to build the runtime:

```shell
lo build runtime runtime/base
```

## lo.config.js

the full lo runtime with a relatively arbitrarily chosen "standard library" of 
common binding and modules.

to build the runtime:

```shell
lo build runtime runtime/lo
```
