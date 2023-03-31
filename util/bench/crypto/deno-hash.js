import { Md5 } from "https://deno.land/std/hash/md5.ts"

const encoder = new TextEncoder()
const hello = encoder.encode('hello')

const digest = (new Md5()).update(hello).digest()
