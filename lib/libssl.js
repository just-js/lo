import { api } from 'lib/libssl/api.js'

const get_libssl = () => {
  const libssl_base = lo.load('libssl').libssl

  const { wrap } = lo
  const {
    SSL_OP_ALL, SSL_OP_NO_RENEGOTIATION, SSL_OP_NO_SSLv3, SSL_OP_NO_TLSv1,
    SSL_OP_NO_TLSv1_1, SSL_OP_NO_DTLSv1, SSL_OP_NO_DTLSv1_2, SSL_OP_NO_COMPRESSION
  } = libssl_base

  const handle = new Uint32Array(2)

  /**
   * @template {keyof typeof api} T
   * @param {T} k
   * @returns {T extends keyof typeof libssl_base ? typeof api[T]['result'] extends 'pointer'|'u64' ? T : false : false}
   * */
  const falsifyKeysNotToWrap = (k) => {
    return /**@type {T extends keyof typeof libssl_base ? typeof api[T]['result'] extends 'pointer'|'u64' ? T : false : false}*/(
      /**@type{unknown}*/(
        k in libssl_base && (api[k].result === 'pointer' || api[k].result === 'u64') ? k : false
      )
    )
  }
  /**
   * @template {unknown[]} T
   * @param {T} a
   */
  const excludeFalsyItems = (a) => /**@type {Exclude<T[number], false>[]}*/(a.filter(k => k))
  /**
   * @template {{}} T
   * @param {T} o
   */
  const getKeys = (o) => /**@type {(keyof T)[]} */(Object.keys(o))
  const keysToWrap = excludeFalsyItems(getKeys(api).map(falsifyKeysNotToWrap))
  /**
   * @template {(typeof keysToWrap)[number]} T
   * @param {T} k
   */
  const wrappedFnForKey = (k) => /**@type {(...p: Parameters<NativeLibApiFn<(typeof api)[T]>>) => number}*/(/**@type {unknown}*/(wrap(handle, libssl_base[k], api[k].parameters.length)))
  const objectWithWrappedKeys = keysToWrap.reduce((prev, next) => {
    prev[next] = wrappedFnForKey(next)
    return prev;
  }, /**@type {{ [k in (typeof keysToWrap)[number]]: (...p: Parameters<NativeLibApiFn<(typeof api)[k]>>) => number }}*/({}))

  const default_options = SSL_OP_ALL | SSL_OP_NO_RENEGOTIATION | SSL_OP_NO_SSLv3 |
    SSL_OP_NO_TLSv1 | SSL_OP_NO_TLSv1_1 | SSL_OP_NO_DTLSv1 | SSL_OP_NO_DTLSv1_2 |
    SSL_OP_NO_COMPRESSION

  const libssl = Object.assign({}, libssl_base, objectWithWrappedKeys, { default_options });

  return libssl
}

const get_boringssl = () => {
  const libssl_base = lo.load('boringssl').boringssl

  const { wrap } = lo
  const {
    SSL_OP_ALL, SSL_OP_NO_RENEGOTIATION, SSL_OP_NO_SSLv3, SSL_OP_NO_TLSv1,
    SSL_OP_NO_TLSv1_1, SSL_OP_NO_DTLSv1, SSL_OP_NO_DTLSv1_2, SSL_OP_NO_COMPRESSION
  } = libssl_base

  const handle = new Uint32Array(2)

  /**
   * @template {keyof typeof api} T
   * @param {T} k
   * @returns {T extends keyof typeof libssl_base ? typeof api[T]['result'] extends 'pointer'|'u64' ? T : false : false}
   * */
  const falsifyKeysNotToWrap = (k) => {
    return /**@type {T extends keyof typeof libssl_base ? typeof api[T]['result'] extends 'pointer'|'u64' ? T : false : false}*/(
      /**@type{unknown}*/(
        k in libssl_base && (api[k].result === 'pointer' || api[k].result === 'u64') ? k : false
      )
    )
  }
  /**
   * @template {unknown[]} T
   * @param {T} a
   */
  const excludeFalsyItems = (a) => /**@type {Exclude<T[number], false>[]}*/(a.filter(k => k))
  /**
   * @template {{}} T
   * @param {T} o
   */
  const getKeys = (o) => /**@type {(keyof T)[]} */(Object.keys(o))
  const keysToWrap = excludeFalsyItems(getKeys(api).map(falsifyKeysNotToWrap))
  /**
   * @template {(typeof keysToWrap)[number]} T
   * @param {T} k
   */
  const wrappedFnForKey = (k) => /**@type {(...p: Parameters<NativeLibApiFn<(typeof api)[T]>>) => number}*/(/**@type {unknown}*/(wrap(handle, libssl_base[k], api[k].parameters.length)))
  const objectWithWrappedKeys = keysToWrap.reduce((prev, next) => {
    prev[next] = wrappedFnForKey(next)
    return prev;
  }, /**@type {{ [k in (typeof keysToWrap)[number]]: (...p: Parameters<NativeLibApiFn<(typeof api)[k]>>) => number }}*/({}))

  const default_options = SSL_OP_ALL | SSL_OP_NO_RENEGOTIATION | SSL_OP_NO_SSLv3 |
    SSL_OP_NO_TLSv1 | SSL_OP_NO_TLSv1_1 | SSL_OP_NO_DTLSv1 | SSL_OP_NO_DTLSv1_2 |
    SSL_OP_NO_COMPRESSION

  const libssl = Object.assign({}, libssl_base, objectWithWrappedKeys, { default_options });

  return libssl
}

const libssl = lo.getenv('LOSSL') === 'boringssl' ? get_boringssl() : get_libssl()

export { libssl, get_libssl, get_boringssl }
