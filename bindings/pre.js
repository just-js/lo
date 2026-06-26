import { writeFileSync } from 'node:fs'

writeFileSync(`v8-fast-api-calls.h`, await (await fetch(`https://raw.githubusercontent.com/v8/v8/refs/tags/${process.versions.v8.substring(0, process.versions.v8.indexOf('-'))}/include/v8-fast-api-calls.h`)).text())
