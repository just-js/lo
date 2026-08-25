function read_file (path, flags = defaultReadFlags, size = 0) {
  const fd = open(path, flags)
  assert(fd > 0, `failed to open ${path} with flags ${flags}`)
  if (size === 0) {
    assert(fstat(fd, stat.ptr) === 0)
    if (core.os === 'mac') {
      size = Number(st[12])
    } else if (core.os === 'win') {
      size = stat32[5]
    } else {
      size = Number(st[6])
    }
  }
  let off = 0
  let len = 0
  // todo - check for max size
  const u8 = ptr(new Uint8Array(size))
  while ((len = read(fd, u8.ptr, size - off)) > 0) off += len
  close(fd)
  return u8
}

function require (file_path) {
  if (requireCache.has(file_path)) {
    return requireCache.get(file_path).exports
  }
  const src = lo.builtin(file_path)
  const f = new Function('exports', 'module', 'require', src)
  const mod = { exports: {} }
  f.call(globalThis, mod.exports, mod, require)
  requireCache.set(file_path, mod)
  return mod.exports
}

// https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API

function createCompilerHost(options, moduleSearchLocations) {
  return {
    getSourceFile,
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: (fileName, content) => {
      lo.print(`writeFile: ${fileName}\n`)
      return ts.sys.writeFile(fileName, content)
    },
    getCurrentDirectory: () => {
      lo.print(`getCurrentDirectory\n`)
      return '/root/cloned/claude/repos/lo'
      return ts.sys.getCurrentDirectory()
    },
    getDirectories: path => {
      lo.print(`getDirectories: ${path}\n`)
      return ts.sys.getDirectories(path)
    },
    getCanonicalFileName: fileName => {
      lo.print(`getCanonicalFileName: ${fileName}\n`)
      return fileName
      return ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()
    },
    getNewLine: () => {
      lo.print(`getNewLine\n`)
      return ts.sys.newLine
    },
    useCaseSensitiveFileNames: () => {
      lo.print(`useCaseSensitiveFileNames\n`)
      return true
    },
    fileExists,
    readFile,
    resolveModuleNames
  };

  function fileExists(fileName) {
    lo.print(`fileExists: ${fileName}\n`)
    return ts.sys.fileExists(fileName);
  }

  function readFile(fileName) {
    lo.print(`readFile: ${fileName}\n`)
    return ts.sys.readFile(fileName);
  }

  function getSourceFile(fileName, languageVersion, onError = () => {}) {
    lo.print(`getSourceFile: ${fileName}\n`)
    //const sourceText = ts.sys.readFile(fileName);
    const sourceText = `const foo: number = "hello";
lo.print(foo);   
`
    return sourceText !== undefined
      ? ts.createSourceFile(fileName, sourceText, languageVersion)
      : undefined;
  }

  function resolveModuleNames(
    moduleNames,
    containingFile
  ) {
    lo.print(`resolveModuleNames: ${moduleNames} (${containingFile})\n`)
    const resolvedModules = [];
    for (const moduleName of moduleNames) {
      // try to use standard resolution
      let result = ts.resolveModuleName(moduleName, containingFile, options, {
        fileExists,
        readFile
      });
      if (result.resolvedModule) {
        resolvedModules.push(result.resolvedModule);
      } else {
        // check fallback locations, for simplicity assume that module at location
        // should be represented by '.d.ts' file
        for (const location of moduleSearchLocations) {
          const modulePath = path.join(location, moduleName + ".d.ts");
          if (fileExists(modulePath)) {
            resolvedModules.push({ resolvedFileName: modulePath });
          }
        }
      }
    }
    return resolvedModules;
  }
}

function compile(sourceFiles, moduleSearchLocations) {
  const options = {
    module: ts.ModuleKind.ESM,
    target: ts.ScriptTarget.ES5
  };
  const host = createCompilerHost(options, moduleSearchLocations);
  return ts.createProgram(sourceFiles, options, host);
}

const requireCache = new Map()
globalThis.ts = require('runtime/typescript.js')

/*
function compile(fileNames, options) {
  let program = ts.createProgram(fileNames, options)
  let emitResult = program.emit()

  let allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics)
  allDiagnostics.forEach(diagnostic => {
    if (diagnostic.file) {
      let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start)
      let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      lo.print(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}\n`)
    } else {
      lo.print(`${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}\n`)
    }
  })
  let exitCode = emitResult.emitSkipped ? 1 : 0
  lo.print(`Process exiting with code '${exitCode}'.\n`)
  lo.exit(exitCode)
}
*/

globalThis.tsc = {
  compile
}

globalThis.snapshotEntry = async function () {
  try {
    const program = tsc.compile(lo.args.slice(1), {
      noEmitOnError: true,
      noImplicitAny: true,
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.CommonJS
    })
    lo.print(`${JSON.stringify(program)}\n`)
  } catch (err) {
    lo.print(`${err.stack}\n`)
  }
}