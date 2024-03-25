import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec, exec_env } from 'lib/proc.js'
import { obj } from 'lib/curl/api.js'

async function build () {
  const { assert, core, getenv } = lo
  // we use system libcurl on macos
  if (core.os === 'mac') return
  const {
    chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile
  } = core
  const LO_HOME = getenv('LO_HOME') || '.'
  if (!isDir('deps/curl')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    assert(chdir('deps') === 0)
    if (!isFile('curl.tar.gz')) {
      console.log('fetching release')
      fetch('https://github.com/curl/curl/releases/download/curl-8_5_0/curl-8.5.0.tar.gz', 
        'curl.tar.gz')
    }
    const bytes = readFile('curl.tar.gz')
    const dir_name = untar(inflate(bytes))
    const cwd = lo.getcwd()
    assert(lo.core.rename(`${cwd}/${dir_name}`, `${cwd}/curl`) === 0)
    assert(chdir('../') === 0)
  }
  if (obj.some(o => !isFile(o))) {
//    const curl_opts = `--disable-openssl-auto-load-config --without-default-ssl-backend --without-brotli --with-openssl --disable-tls-srp --disable-threaded-resolver --disable-ipv6 --disable-unix-sockets --disable-manual --disable-verbose --disable-rtsp --disable-alt-svc --disable-headers-api --disable-hsts --disable-ftp --disable-ldap --disable-file --disable-ldap --disable-proxy --disable-rtsp --disable-dict --disable-telnet --disable-tftp --disable-pop3 --disable-imap --disable-smb --disable-smtp --disable-gopher --disable-mqtt --disable-sspi --disable-kerberos-auth --disable-negotiate-auth --disable-aws --disable-cookies --disable-mime --disable-bindlocal --disable-form-api --disable-netrc --disable-progress-meter --disable-dnsshuffle --disable-websockets --disable-largefile --disable-debug --disable-curldebug --disable-ares --disable-rt --disable-ech --disable-dependency-tracking --enable-shared --enable-static --disable-libcurl-option --disable-ntlm --disable-ntlm-wb --with-ssl=${LO_HOME}/lib/libssl/deps/openssl`
    //const curl_opts = `--disable-openssl-auto-load-config --without-default-ssl-backend --without-brotli --with-openssl --disable-tls-srp --disable-ipv6 --disable-unix-sockets --disable-manual --disable-verbose --disable-rtsp --disable-alt-svc --disable-headers-api --disable-hsts --disable-ftp --disable-ldap --disable-file --disable-ldap --disable-proxy --disable-rtsp --disable-dict --disable-telnet --disable-tftp --disable-pop3 --disable-imap --disable-smb --disable-smtp --disable-gopher --disable-mqtt --disable-sspi --disable-kerberos-auth --disable-negotiate-auth --disable-aws --disable-cookies --disable-mime --disable-bindlocal --disable-form-api --disable-netrc --disable-progress-meter --disable-dnsshuffle --disable-websockets --disable-largefile --disable-debug --disable-curldebug --disable-ares --disable-rt --disable-ech --disable-dependency-tracking --enable-shared --enable-static --disable-libcurl-option --disable-ntlm --disable-ntlm-wb --with-ssl=${LO_HOME}/lib/libssl/deps/openssl`
    //const curl_opts = `--disable-openssl-auto-load-config --without-default-ssl-backend --with-openssl --disable-tls-srp --disable-threaded-resolver --disable-ipv6 --disable-unix-sockets --disable-manual --disable-verbose --disable-rtsp --disable-alt-svc --disable-headers-api --disable-hsts --disable-ftp --disable-ldap --disable-file --disable-ldap --disable-proxy --disable-rtsp --disable-dict --disable-telnet --disable-tftp --disable-pop3 --disable-imap --disable-smb --disable-smtp --disable-gopher --disable-mqtt --disable-sspi --disable-kerberos-auth --disable-negotiate-auth --disable-aws --disable-cookies --disable-mime --disable-bindlocal --disable-form-api --disable-netrc --disable-progress-meter --disable-dnsshuffle --disable-websockets --disable-largefile --disable-debug --disable-curldebug --disable-ares --disable-rt --disable-ech --disable-dependency-tracking --enable-shared --enable-static --disable-libcurl-option --disable-ntlm --disable-ntlm-wb --with-ssl=${LO_HOME}/lib/boringssl/deps/boringssl`
    const curl_opts = `--disable-rtsp --disable-kerberos-auth --disable-ntlm --disable-ntlm-wb --disable-ech --disable-tls-srp --without-brotli --with-openssl --enable-shared --enable-static --with-ssl=${LO_HOME}/lib/libssl/deps/openssl`
    assert(chdir('deps/curl') === 0)
    assert(exec('make', ['clean'])[0] === 0)
    exec_env('./configure', curl_opts.split(' '), [['CFLAGS', '-fPIC -O3 -march=native -mtune=native -DOPENSSL_NO_ENGINE']])
    assert(exec_env('make', ['-j', '4'], [['CFLAGS', '-fPIC -O3 -march=native -mtune=native -DOPENSSL_NO_ENGINE']])[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
