#ifndef RUSTLS_H
#define RUSTLS_H

#include <stdarg.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>

enum rustls_result
#ifdef __cplusplus
  : uint32_t
#endif // __cplusplus
 {
  RUSTLS_RESULT_OK = 7000,
  RUSTLS_RESULT_IO = 7001,
  RUSTLS_RESULT_NULL_PARAMETER = 7002,
  RUSTLS_RESULT_INVALID_DNS_NAME_ERROR = 7003,
  RUSTLS_RESULT_PANIC = 7004,
  RUSTLS_RESULT_CERTIFICATE_PARSE_ERROR = 7005,
  RUSTLS_RESULT_PRIVATE_KEY_PARSE_ERROR = 7006,
  RUSTLS_RESULT_INSUFFICIENT_SIZE = 7007,
  RUSTLS_RESULT_NOT_FOUND = 7008,
  RUSTLS_RESULT_INVALID_PARAMETER = 7009,
  RUSTLS_RESULT_UNEXPECTED_EOF = 7010,
  RUSTLS_RESULT_PLAINTEXT_EMPTY = 7011,
  RUSTLS_RESULT_ACCEPTOR_NOT_READY = 7012,
  RUSTLS_RESULT_ALREADY_USED = 7013,
  RUSTLS_RESULT_CERTIFICATE_REVOCATION_LIST_PARSE_ERROR = 7014,
  RUSTLS_RESULT_NO_CERTIFICATES_PRESENTED = 7101,
  RUSTLS_RESULT_DECRYPT_ERROR = 7102,
  RUSTLS_RESULT_FAILED_TO_GET_CURRENT_TIME = 7103,
  RUSTLS_RESULT_FAILED_TO_GET_RANDOM_BYTES = 7113,
  RUSTLS_RESULT_HANDSHAKE_NOT_COMPLETE = 7104,
  RUSTLS_RESULT_PEER_SENT_OVERSIZED_RECORD = 7105,
  RUSTLS_RESULT_NO_APPLICATION_PROTOCOL = 7106,
  RUSTLS_RESULT_BAD_MAX_FRAGMENT_SIZE = 7114,
  RUSTLS_RESULT_UNSUPPORTED_NAME_TYPE = 7115,
  RUSTLS_RESULT_ENCRYPT_ERROR = 7116,
  RUSTLS_RESULT_CERT_ENCODING_BAD = 7121,
  RUSTLS_RESULT_CERT_EXPIRED = 7122,
  RUSTLS_RESULT_CERT_NOT_YET_VALID = 7123,
  RUSTLS_RESULT_CERT_REVOKED = 7124,
  RUSTLS_RESULT_CERT_UNHANDLED_CRITICAL_EXTENSION = 7125,
  RUSTLS_RESULT_CERT_UNKNOWN_ISSUER = 7126,
  RUSTLS_RESULT_CERT_BAD_SIGNATURE = 7127,
  RUSTLS_RESULT_CERT_NOT_VALID_FOR_NAME = 7128,
  RUSTLS_RESULT_CERT_INVALID_PURPOSE = 7129,
  RUSTLS_RESULT_CERT_APPLICATION_VERIFICATION_FAILURE = 7130,
  RUSTLS_RESULT_CERT_OTHER_ERROR = 7131,
  RUSTLS_RESULT_MESSAGE_HANDSHAKE_PAYLOAD_TOO_LARGE = 7133,
  RUSTLS_RESULT_MESSAGE_INVALID_CCS = 7134,
  RUSTLS_RESULT_MESSAGE_INVALID_CONTENT_TYPE = 7135,
  RUSTLS_RESULT_MESSAGE_INVALID_CERT_STATUS_TYPE = 7136,
  RUSTLS_RESULT_MESSAGE_INVALID_CERT_REQUEST = 7137,
  RUSTLS_RESULT_MESSAGE_INVALID_DH_PARAMS = 7138,
  RUSTLS_RESULT_MESSAGE_INVALID_EMPTY_PAYLOAD = 7139,
  RUSTLS_RESULT_MESSAGE_INVALID_KEY_UPDATE = 7140,
  RUSTLS_RESULT_MESSAGE_INVALID_SERVER_NAME = 7141,
  RUSTLS_RESULT_MESSAGE_TOO_LARGE = 7142,
  RUSTLS_RESULT_MESSAGE_TOO_SHORT = 7143,
  RUSTLS_RESULT_MESSAGE_MISSING_DATA = 7144,
  RUSTLS_RESULT_MESSAGE_MISSING_KEY_EXCHANGE = 7145,
  RUSTLS_RESULT_MESSAGE_NO_SIGNATURE_SCHEMES = 7146,
  RUSTLS_RESULT_MESSAGE_TRAILING_DATA = 7147,
  RUSTLS_RESULT_MESSAGE_UNEXPECTED_MESSAGE = 7148,
  RUSTLS_RESULT_MESSAGE_UNKNOWN_PROTOCOL_VERSION = 7149,
  RUSTLS_RESULT_MESSAGE_UNSUPPORTED_COMPRESSION = 7150,
  RUSTLS_RESULT_MESSAGE_UNSUPPORTED_CURVE_TYPE = 7151,
  RUSTLS_RESULT_MESSAGE_UNSUPPORTED_KEY_EXCHANGE_ALGORITHM = 7152,
  RUSTLS_RESULT_MESSAGE_INVALID_OTHER = 7153,
  RUSTLS_RESULT_PEER_INCOMPATIBLE_ERROR = 7107,
  RUSTLS_RESULT_PEER_MISBEHAVED_ERROR = 7108,
  RUSTLS_RESULT_INAPPROPRIATE_MESSAGE = 7109,
  RUSTLS_RESULT_INAPPROPRIATE_HANDSHAKE_MESSAGE = 7110,
  RUSTLS_RESULT_GENERAL = 7112,
  RUSTLS_RESULT_ALERT_CLOSE_NOTIFY = 7200,
  RUSTLS_RESULT_ALERT_UNEXPECTED_MESSAGE = 7201,
  RUSTLS_RESULT_ALERT_BAD_RECORD_MAC = 7202,
  RUSTLS_RESULT_ALERT_DECRYPTION_FAILED = 7203,
  RUSTLS_RESULT_ALERT_RECORD_OVERFLOW = 7204,
  RUSTLS_RESULT_ALERT_DECOMPRESSION_FAILURE = 7205,
  RUSTLS_RESULT_ALERT_HANDSHAKE_FAILURE = 7206,
  RUSTLS_RESULT_ALERT_NO_CERTIFICATE = 7207,
  RUSTLS_RESULT_ALERT_BAD_CERTIFICATE = 7208,
  RUSTLS_RESULT_ALERT_UNSUPPORTED_CERTIFICATE = 7209,
  RUSTLS_RESULT_ALERT_CERTIFICATE_REVOKED = 7210,
  RUSTLS_RESULT_ALERT_CERTIFICATE_EXPIRED = 7211,
  RUSTLS_RESULT_ALERT_CERTIFICATE_UNKNOWN = 7212,
  RUSTLS_RESULT_ALERT_ILLEGAL_PARAMETER = 7213,
  RUSTLS_RESULT_ALERT_UNKNOWN_CA = 7214,
  RUSTLS_RESULT_ALERT_ACCESS_DENIED = 7215,
  RUSTLS_RESULT_ALERT_DECODE_ERROR = 7216,
  RUSTLS_RESULT_ALERT_DECRYPT_ERROR = 7217,
  RUSTLS_RESULT_ALERT_EXPORT_RESTRICTION = 7218,
  RUSTLS_RESULT_ALERT_PROTOCOL_VERSION = 7219,
  RUSTLS_RESULT_ALERT_INSUFFICIENT_SECURITY = 7220,
  RUSTLS_RESULT_ALERT_INTERNAL_ERROR = 7221,
  RUSTLS_RESULT_ALERT_INAPPROPRIATE_FALLBACK = 7222,
  RUSTLS_RESULT_ALERT_USER_CANCELED = 7223,
  RUSTLS_RESULT_ALERT_NO_RENEGOTIATION = 7224,
  RUSTLS_RESULT_ALERT_MISSING_EXTENSION = 7225,
  RUSTLS_RESULT_ALERT_UNSUPPORTED_EXTENSION = 7226,
  RUSTLS_RESULT_ALERT_CERTIFICATE_UNOBTAINABLE = 7227,
  RUSTLS_RESULT_ALERT_UNRECOGNISED_NAME = 7228,
  RUSTLS_RESULT_ALERT_BAD_CERTIFICATE_STATUS_RESPONSE = 7229,
  RUSTLS_RESULT_ALERT_BAD_CERTIFICATE_HASH_VALUE = 7230,
  RUSTLS_RESULT_ALERT_UNKNOWN_PSK_IDENTITY = 7231,
  RUSTLS_RESULT_ALERT_CERTIFICATE_REQUIRED = 7232,
  RUSTLS_RESULT_ALERT_NO_APPLICATION_PROTOCOL = 7233,
  RUSTLS_RESULT_ALERT_UNKNOWN = 7234,
  RUSTLS_RESULT_CERT_REVOCATION_LIST_BAD_SIGNATURE = 7400,
  RUSTLS_RESULT_CERT_REVOCATION_LIST_INVALID_CRL_NUMBER = 7401,
  RUSTLS_RESULT_CERT_REVOCATION_LIST_INVALID_REVOKED_CERT_SERIAL_NUMBER = 7402,
  RUSTLS_RESULT_CERT_REVOCATION_LIST_ISSUER_INVALID_FOR_CRL = 7403,
  RUSTLS_RESULT_CERT_REVOCATION_LIST_OTHER_ERROR = 7404,
  RUSTLS_RESULT_CERT_REVOCATION_LIST_PARSE_ERROR = 7405,
  RUSTLS_RESULT_CERT_REVOCATION_LIST_UNSUPPORTED_CRL_VERSION = 7406,
  RUSTLS_RESULT_CERT_REVOCATION_LIST_UNSUPPORTED_CRITICAL_EXTENSION = 7407,
  RUSTLS_RESULT_CERT_REVOCATION_LIST_UNSUPPORTED_DELTA_CRL = 7408,
  RUSTLS_RESULT_CERT_REVOCATION_LIST_UNSUPPORTED_INDIRECT_CRL = 7409,
  RUSTLS_RESULT_CERT_REVOCATION_LIST_UNSUPPORTED_REVOCATION_REASON = 7410,
  RUSTLS_RESULT_CLIENT_CERT_VERIFIER_BUILDER_NO_ROOT_ANCHORS = 7500,
};
#ifndef __cplusplus
typedef uint32_t rustls_result;
#endif // __cplusplus

/**
 * Definitions of known TLS protocol versions.
 */
typedef enum rustls_tls_version {
  RUSTLS_TLS_VERSION_SSLV2 = 512,
  RUSTLS_TLS_VERSION_SSLV3 = 768,
  RUSTLS_TLS_VERSION_TLSV1_0 = 769,
  RUSTLS_TLS_VERSION_TLSV1_1 = 770,
  RUSTLS_TLS_VERSION_TLSV1_2 = 771,
  RUSTLS_TLS_VERSION_TLSV1_3 = 772,
} rustls_tls_version;

/**
 * A parsed ClientHello produced by a rustls_acceptor. It is used to check
 * server name indication (SNI), ALPN protocols, signature schemes, and
 * cipher suites. It can be combined with a rustls_server_config to build a
 * rustls_connection.
 */
typedef struct rustls_accepted rustls_accepted;

/**
 * A buffer and parser for ClientHello bytes. This allows reading ClientHello
 * before choosing a rustls_server_config. It's useful when the server
 * config will be based on parameters in the ClientHello: server name
 * indication (SNI), ALPN protocols, signature schemes, and cipher suites. In
 * particular, if a server wants to do some potentially expensive work to load a
 * certificate for a given hostname, rustls_acceptor allows doing that asynchronously,
 * as opposed to rustls_server_config_builder_set_hello_callback(), which doesn't
 * work well for asynchronous I/O.
 *
 * The general flow is:
 *  - rustls_acceptor_new()
 *  - Loop:
 *    - Read bytes from the network it with rustls_acceptor_read_tls().
 *    - If successful, parse those bytes with rustls_acceptor_accept().
 *    - If that returns RUSTLS_RESULT_ACCEPTOR_NOT_READY, continue.
 *    - Otherwise, break.
 *  - If rustls_acceptor_accept() returned RUSTLS_RESULT_OK:
 *    - Examine the resulting rustls_accepted.
 *    - Create or select a rustls_server_config.
 *    - Call rustls_accepted_into_connection().
 *  - Otherwise, there was a problem with the ClientHello data and the
 *    connection should be rejected.
 */
typedef struct rustls_acceptor rustls_acceptor;

/**
 * An X.509 certificate, as used in rustls.
 * Corresponds to `CertificateDer` in the Rust pki-types API.
 * <https://docs.rs/rustls-pki-types/latest/rustls_pki_types/struct.CertificateDer.html>
 */
typedef struct rustls_certificate rustls_certificate;

/**
 * The complete chain of certificates to send during a TLS handshake,
 * plus a private key that matches the end-entity (leaf) certificate.
 * Corresponds to `CertifiedKey` in the Rust API.
 * <https://docs.rs/rustls/latest/rustls/sign/struct.CertifiedKey.html>
 */
typedef struct rustls_certified_key rustls_certified_key;

/**
 * A built client certificate verifier that can be provided to a `rustls_server_config_builder`
 * with `rustls_server_config_builder_set_client_verifier`.
 */
typedef struct rustls_client_cert_verifier rustls_client_cert_verifier;

/**
 * A client config that is done being constructed and is now read-only.
 * Under the hood, this object corresponds to an `Arc<ClientConfig>`.
 * <https://docs.rs/rustls/latest/rustls/struct.ClientConfig.html>
 */
typedef struct rustls_client_config rustls_client_config;

/**
 * A client config being constructed. A builder can be modified by,
 * e.g. rustls_client_config_builder_load_roots_from_file. Once you're
 * done configuring settings, call rustls_client_config_builder_build
 * to turn it into a *rustls_client_config. This object is not safe
 * for concurrent mutation. Under the hood, it corresponds to a
 * `Box<ClientConfig>`.
 * <https://docs.rs/rustls/latest/rustls/struct.ConfigBuilder.html>
 */
typedef struct rustls_client_config_builder rustls_client_config_builder;

typedef struct rustls_connection rustls_connection;

/**
 * An alias for `struct iovec` from uio.h (on Unix) or `WSABUF` on Windows. You should cast
 * `const struct rustls_iovec *` to `const struct iovec *` on Unix, or `const *LPWSABUF`
 * on Windows. See [`std::io::IoSlice`] for details on interoperability with platform
 * specific vectored IO.
 */
typedef struct rustls_iovec rustls_iovec;

/**
 * A root certificate store.
 * <https://docs.rs/rustls/latest/rustls/struct.RootCertStore.html>
 */
typedef struct rustls_root_cert_store rustls_root_cert_store;

/**
 * A `rustls_root_cert_store` being constructed.
 *
 * A builder can be modified by adding trust anchor root certificates with
 * `rustls_root_cert_store_builder_add_pem`. Once you're done adding root certificates,
 * call `rustls_root_cert_store_builder_build` to turn it into a `rustls_root_cert_store`.
 * This object is not safe for concurrent mutation.
 */
typedef struct rustls_root_cert_store_builder rustls_root_cert_store_builder;

/**
 * A built server certificate verifier that can be provided to a `rustls_client_config_builder`
 * with `rustls_client_config_builder_set_server_verifier`.
 */
typedef struct rustls_server_cert_verifier rustls_server_cert_verifier;

/**
 * A server config that is done being constructed and is now read-only.
 * Under the hood, this object corresponds to an `Arc<ServerConfig>`.
 * <https://docs.rs/rustls/latest/rustls/struct.ServerConfig.html>
 */
typedef struct rustls_server_config rustls_server_config;

/**
 * A server config being constructed. A builder can be modified by,
 * e.g. rustls_server_config_builder_load_native_roots. Once you're
 * done configuring settings, call rustls_server_config_builder_build
 * to turn it into a *const rustls_server_config. This object is not safe
 * for concurrent mutation.
 * <https://docs.rs/rustls/latest/rustls/struct.ConfigBuilder.html>
 */
typedef struct rustls_server_config_builder rustls_server_config_builder;

/**
 * A read-only view of a slice of Rust byte slices.
 *
 * This is used to pass data from rustls-ffi to callback functions provided
 * by the user of the API. Because Vec and slice are not `#[repr(C)]`, we
 * provide access via a pointer to an opaque struct and an accessor method
 * that acts on that struct to get entries of type `rustls_slice_bytes`.
 * Internally, the pointee is a `&[&[u8]]`.
 *
 * The memory exposed is available as specified by the function
 * using this in its signature. For instance, when this is a parameter to a
 * callback, the lifetime will usually be the duration of the callback.
 * Functions that receive one of these must not call its methods beyond the
 * allowed lifetime.
 */
typedef struct rustls_slice_slice_bytes rustls_slice_slice_bytes;

/**
 * A read-only view of a slice of multiple Rust `&str`'s (that is, multiple
 * strings). Like `rustls_str`, this guarantees that each string contains
 * UTF-8 and no NUL bytes. Strings are not NUL-terminated.
 *
 * This is used to pass data from rustls-ffi to callback functions provided
 * by the user of the API. Because Vec and slice are not `#[repr(C)]`, we
 * can't provide a straightforward `data` and `len` structure. Instead, we
 * provide access via a pointer to an opaque struct and accessor methods.
 * Internally, the pointee is a `&[&str]`.
 *
 * The memory exposed is available as specified by the function
 * using this in its signature. For instance, when this is a parameter to a
 * callback, the lifetime will usually be the duration of the callback.
 * Functions that receive one of these must not call its methods beyond the
 * allowed lifetime.
 */
typedef struct rustls_slice_str rustls_slice_str;

/**
 * A cipher suite supported by rustls.
 */
typedef struct rustls_supported_ciphersuite rustls_supported_ciphersuite;

/**
 * A client certificate verifier being constructed. A builder can be modified by,
 * e.g. `rustls_web_pki_client_cert_verifier_builder_add_crl`. Once you're
 * done configuring settings, call `rustls_web_pki_client_cert_verifier_builder_build`
 * to turn it into a `rustls_client_cert_verifier`. This object is not safe
 * for concurrent mutation.
 *
 * See <https://docs.rs/rustls/latest/rustls/server/struct.ClientCertVerifierBuilder.html>
 * for more information.
 */
typedef struct rustls_web_pki_client_cert_verifier_builder rustls_web_pki_client_cert_verifier_builder;

/**
 * A server certificate verifier being constructed. A builder can be modified by,
 * e.g. `rustls_web_pki_server_cert_verifier_builder_add_crl`. Once you're
 * done configuring settings, call `rustls_web_pki_server_cert_verifier_builder_build`
 * to turn it into a `rustls_server_cert_verifier`. This object is not safe
 * for concurrent mutation.
 *
 * See <https://docs.rs/rustls/latest/rustls/client/struct.ServerCertVerifierBuilder.html>
 * for more information.
 */
typedef struct rustls_web_pki_server_cert_verifier_builder rustls_web_pki_server_cert_verifier_builder;

/**
 * A read-only view on a Rust `&str`. The contents are guaranteed to be valid
 * UTF-8. As an additional guarantee on top of Rust's normal UTF-8 guarantee,
 * a `rustls_str` is guaranteed not to contain internal NUL bytes, so it is
 * safe to interpolate into a C string or compare using strncmp. Keep in mind
 * that it is not NUL-terminated.
 *
 * The memory exposed is available as specified by the function
 * using this in its signature. For instance, when this is a parameter to a
 * callback, the lifetime will usually be the duration of the callback.
 * Functions that receive one of these must not dereference the data pointer
 * beyond the allowed lifetime.
 */
typedef struct rustls_str {
  const char *data;
  size_t len;
} rustls_str;

/**
 * A return value for a function that may return either success (0) or a
 * non-zero value representing an error. The values should match socket
 * error numbers for your operating system - for example, the integers for
 * ETIMEDOUT, EAGAIN, or similar.
 */
typedef int rustls_io_result;

/**
 * A callback for rustls_connection_read_tls.
 * An implementation of this callback should attempt to read up to n bytes from the
 * network, storing them in `buf`. If any bytes were stored, the implementation should
 * set out_n to the number of bytes stored and return 0. If there was an error,
 * the implementation should return a nonzero rustls_io_result, which will be
 * passed through to the caller. On POSIX systems, returning `errno` is convenient.
 * On other systems, any appropriate error code works.
 * It's best to make one read attempt to the network per call. Additional reads will
 * be triggered by subsequent calls to one of the `_read_tls` methods.
 * `userdata` is set to the value provided to `rustls_connection_set_userdata`. In most
 * cases that should be a struct that contains, at a minimum, a file descriptor.
 * The buf and out_n pointers are borrowed and should not be retained across calls.
 */
typedef rustls_io_result (*rustls_read_callback)(void *userdata,
                                                 uint8_t *buf,
                                                 size_t n,
                                                 size_t *out_n);

/**
 * A read-only view on a Rust byte slice.
 *
 * This is used to pass data from rustls-ffi to callback functions provided
 * by the user of the API.
 * `len` indicates the number of bytes than can be safely read.
 *
 * The memory exposed is available as specified by the function
 * using this in its signature. For instance, when this is a parameter to a
 * callback, the lifetime will usually be the duration of the callback.
 * Functions that receive one of these must not dereference the data pointer
 * beyond the allowed lifetime.
 */
typedef struct rustls_slice_bytes {
  const uint8_t *data;
  size_t len;
} rustls_slice_bytes;

/**
 * User-provided input to a custom certificate verifier callback. See
 * rustls_client_config_builder_dangerous_set_certificate_verifier().
 */
typedef void *rustls_verify_server_cert_user_data;

/**
 * Input to a custom certificate verifier callback. See
 * rustls_client_config_builder_dangerous_set_certificate_verifier().
 *
 * server_name can contain a hostname, an IPv4 address in textual form, or an
 * IPv6 address in textual form.
 */
typedef struct rustls_verify_server_cert_params {
  struct rustls_slice_bytes end_entity_cert_der;
  const struct rustls_slice_slice_bytes *intermediate_certs_der;
  struct rustls_str server_name;
  struct rustls_slice_bytes ocsp_response;
} rustls_verify_server_cert_params;

typedef uint32_t (*rustls_verify_server_cert_callback)(rustls_verify_server_cert_user_data userdata,
                                                       const struct rustls_verify_server_cert_params *params);

typedef size_t rustls_log_level;

typedef struct rustls_log_params {
  rustls_log_level level;
  struct rustls_str message;
} rustls_log_params;

typedef void (*rustls_log_callback)(void *userdata, const struct rustls_log_params *params);

/**
 * A callback for rustls_connection_write_tls.
 * An implementation of this callback should attempt to write the `n` bytes in buf
 * to the network. If any bytes were written, the implementation should
 * set out_n to the number of bytes stored and return 0. If there was an error,
 * the implementation should return a nonzero rustls_io_result, which will be
 * passed through to the caller. On POSIX systems, returning `errno` is convenient.
 * On other systems, any appropriate error code works.
 * It's best to make one write attempt to the network per call. Additional writes will
 * be triggered by subsequent calls to rustls_connection_write_tls.
 * `userdata` is set to the value provided to `rustls_connection_set_userdata`. In most
 * cases that should be a struct that contains, at a minimum, a file descriptor.
 * The buf and out_n pointers are borrowed and should not be retained across calls.
 */
typedef rustls_io_result (*rustls_write_callback)(void *userdata,
                                                  const uint8_t *buf,
                                                  size_t n,
                                                  size_t *out_n);

/**
 * A callback for rustls_connection_write_tls_vectored.
 * An implementation of this callback should attempt to write the bytes in
 * the given `count` iovecs to the network. If any bytes were written,
 * the implementation should set out_n to the number of bytes written and return 0.
 * If there was an error, the implementation should return a nonzero rustls_io_result,
 * which will be passed through to the caller. On POSIX systems, returning `errno` is convenient.
 * On other systems, any appropriate error code works.
 * It's best to make one write attempt to the network per call. Additional write will
 * be triggered by subsequent calls to one of the `_write_tls` methods.
 * `userdata` is set to the value provided to `rustls_*_session_set_userdata`. In most
 * cases that should be a struct that contains, at a minimum, a file descriptor.
 * The buf and out_n pointers are borrowed and should not be retained across calls.
 */
typedef rustls_io_result (*rustls_write_vectored_callback)(void *userdata,
                                                           const struct rustls_iovec *iov,
                                                           size_t count,
                                                           size_t *out_n);

/**
 * Any context information the callback will receive when invoked.
 */
typedef void *rustls_client_hello_userdata;

/**
 * A read-only view on a Rust slice of 16-bit integers in platform endianness.
 *
 * This is used to pass data from rustls-ffi to callback functions provided
 * by the user of the API.
 * `len` indicates the number of bytes than can be safely read.
 *
 * The memory exposed is available as specified by the function
 * using this in its signature. For instance, when this is a parameter to a
 * callback, the lifetime will usually be the duration of the callback.
 * Functions that receive one of these must not dereference the data pointer
 * beyond the allowed lifetime.
 */
typedef struct rustls_slice_u16 {
  const uint16_t *data;
  size_t len;
} rustls_slice_u16;

/**
 * The TLS Client Hello information provided to a ClientHelloCallback function.
 * `server_name` is the value of the ServerNameIndication extension provided
 * by the client. If the client did not send an SNI, the length of this
 * `rustls_string` will be 0. The signature_schemes field carries the values
 * supplied by the client or, if the client did not send this TLS extension,
 * the default schemes in the rustls library. See:
 * <https://docs.rs/rustls/latest/rustls/internal/msgs/enums/enum.SignatureScheme.html>.
 * `alpn` carries the list of ALPN protocol names that the client proposed to
 * the server. Again, the length of this list will be 0 if none were supplied.
 *
 * All this data, when passed to a callback function, is only accessible during
 * the call and may not be modified. Users of this API must copy any values that
 * they want to access when the callback returned.
 *
 * EXPERIMENTAL: this feature of rustls-ffi is likely to change in the future, as
 * the rustls library is re-evaluating their current approach to client hello handling.
 */
typedef struct rustls_client_hello {
  struct rustls_str server_name;
  struct rustls_slice_u16 signature_schemes;
  const struct rustls_slice_slice_bytes *alpn;
} rustls_client_hello;

/**
 * Prototype of a callback that can be installed by the application at the
 * `rustls_server_config`. This callback will be invoked by a `rustls_connection`
 * once the TLS client hello message has been received.
 * `userdata` will be set based on rustls_connection_set_userdata.
 * `hello` gives the value of the available client announcements, as interpreted
 * by rustls. See the definition of `rustls_client_hello` for details.
 *
 * NOTE:
 * - the passed in `hello` and all its values are only available during the
 *   callback invocations.
 * - the passed callback function must be safe to call multiple times concurrently
 *   with the same userdata, unless there is only a single config and connection
 *   where it is installed.
 *
 * EXPERIMENTAL: this feature of rustls-ffi is likely to change in the future, as
 * the rustls library is re-evaluating their current approach to client hello handling.
 */
typedef const struct rustls_certified_key *(*rustls_client_hello_callback)(rustls_client_hello_userdata userdata,
                                                                           const struct rustls_client_hello *hello);

/**
 * Any context information the callback will receive when invoked.
 */
typedef void *rustls_session_store_userdata;

/**
 * Prototype of a callback that can be installed by the application at the
 * `rustls_server_config` or `rustls_client_config`. This callback will be
 * invoked by a TLS session when looking up the data for a TLS session id.
 * `userdata` will be supplied based on rustls_{client,server}_session_set_userdata.
 *
 * The `buf` points to `count` consecutive bytes where the
 * callback is expected to copy the result to. The number of copied bytes
 * needs to be written to `out_n`. The callback should not read any
 * data from `buf`.
 *
 * If the value to copy is larger than `count`, the callback should never
 * do a partial copy but instead remove the value from its store and
 * act as if it was never found.
 *
 * The callback should return RUSTLS_RESULT_OK to indicate that a value was
 * retrieved and written in its entirety into `buf`, or RUSTLS_RESULT_NOT_FOUND
 * if no session was retrieved.
 *
 * When `remove_after` is != 0, the returned data needs to be removed
 * from the store.
 *
 * NOTE: the passed in `key` and `buf` are only available during the
 * callback invocation.
 * NOTE: callbacks used in several sessions via a common config
 * must be implemented thread-safe.
 */
typedef uint32_t (*rustls_session_store_get_callback)(rustls_session_store_userdata userdata,
                                                      const struct rustls_slice_bytes *key,
                                                      int remove_after,
                                                      uint8_t *buf,
                                                      size_t count,
                                                      size_t *out_n);

/**
 * Prototype of a callback that can be installed by the application at the
 * `rustls_server_config` or `rustls_client_config`. This callback will be
 * invoked by a TLS session when a TLS session has been created and an id
 * for later use is handed to the client/has been received from the server.
 * `userdata` will be supplied based on rustls_{client,server}_session_set_userdata.
 *
 * The callback should return RUSTLS_RESULT_OK to indicate that a value was
 * successfully stored, or RUSTLS_RESULT_IO on failure.
 *
 * NOTE: the passed in `key` and `val` are only available during the
 * callback invocation.
 * NOTE: callbacks used in several sessions via a common config
 * must be implemented thread-safe.
 */
typedef uint32_t (*rustls_session_store_put_callback)(rustls_session_store_userdata userdata,
                                                      const struct rustls_slice_bytes *key,
                                                      const struct rustls_slice_bytes *val);

#ifdef __cplusplus
extern "C" {
#endif // __cplusplus

extern const struct rustls_supported_ciphersuite *RUSTLS_ALL_CIPHER_SUITES[9];

extern const size_t RUSTLS_ALL_CIPHER_SUITES_LEN;

extern const struct rustls_supported_ciphersuite *RUSTLS_DEFAULT_CIPHER_SUITES[9];

extern const size_t RUSTLS_DEFAULT_CIPHER_SUITES_LEN;

extern const uint16_t RUSTLS_ALL_VERSIONS[2];

extern const size_t RUSTLS_ALL_VERSIONS_LEN;

extern const uint16_t RUSTLS_DEFAULT_VERSIONS[2];

extern const size_t RUSTLS_DEFAULT_VERSIONS_LEN;

/**
 * Returns a static string containing the rustls-ffi version as well as the
 * rustls version. The string is alive for the lifetime of the program and does
 * not need to be freed.
 */
struct rustls_str rustls_version(void);

/**
 * Create and return a new rustls_acceptor.
 *
 * Caller owns the pointed-to memory and must eventually free it with
 * `rustls_acceptor_free()`.
 */
struct rustls_acceptor *rustls_acceptor_new(void);

/**
 * Free a rustls_acceptor.
 *
 * Parameters:
 *
 * acceptor: The rustls_acceptor to free.
 *
 * Calling with NULL is fine. Must not be called twice with the same value.
 */
void rustls_acceptor_free(struct rustls_acceptor *acceptor);

/**
 * Read some TLS bytes from the network into internal buffers. The actual network
 * I/O is performed by `callback`, which you provide. Rustls will invoke your
 * callback with a suitable buffer to store the read bytes into. You don't have
 * to fill it up, just fill with as many bytes as you get in one syscall.
 *
 * Parameters:
 *
 * acceptor: The rustls_acceptor to read bytes into.
 * callback: A function that will perform the actual network I/O.
 *   Must be valid to call with the given userdata parameter until
 *   this function call returns.
 * userdata: An opaque parameter to be passed directly to `callback`.
 *   Note: this is distinct from the `userdata` parameter set with
 *   `rustls_connection_set_userdata`.
 * out_n: An output parameter. This will be passed through to `callback`,
 *   which should use it to store the number of bytes written.
 *
 * Returns:
 *
 * - 0: Success. You should call `rustls_acceptor_accept()` next.
 * - Any non-zero value: error.
 *
 * This function passes through return values from `callback`. Typically
 * `callback` should return an errno value. See `rustls_read_callback()` for
 * more details.
 */
rustls_io_result rustls_acceptor_read_tls(struct rustls_acceptor *acceptor,
                                          rustls_read_callback callback,
                                          void *userdata,
                                          size_t *out_n);

/**
 * Parse all TLS bytes read so far.  If those bytes make up a ClientHello,
 * create a rustls_accepted from them.
 *
 * Parameters:
 *
 * acceptor: The rustls_acceptor to access.
 * out_accepted: An output parameter. The pointed-to pointer will be set
 *   to a new rustls_accepted only when the function returns
 *   RUSTLS_RESULT_OK. The memory is owned by the caller and must eventually
 *   be freed.
 *
 * Returns:
 *
 * - RUSTLS_RESULT_OK: a ClientHello has successfully been parsed.
 *   A pointer to a newly allocated rustls_accepted has been written to
 *   *out_accepted.
 * - RUSTLS_RESULT_ACCEPTOR_NOT_READY: a full ClientHello has not yet been read.
 *   Read more TLS bytes to continue.
 * - Any other rustls_result: the TLS bytes read so far cannot be parsed
 *   as a ClientHello, and reading additional bytes won't help.
 *
 * Memory and lifetimes:
 *
 * After this method returns RUSTLS_RESULT_OK, `acceptor` is
 * still allocated and valid. It needs to be freed regardless of success
 * or failure of this function.
 *
 * Calling `rustls_acceptor_accept()` multiple times on the same
 * `rustls_acceptor` is acceptable from a memory perspective but pointless
 * from a protocol perspective.
 */
rustls_result rustls_acceptor_accept(struct rustls_acceptor *acceptor,
                                     struct rustls_accepted **out_accepted);

/**
 * Get the server name indication (SNI) from the ClientHello.
 *
 * Parameters:
 *
 * accepted: The rustls_accepted to access.
 *
 * Returns:
 *
 * A rustls_str containing the SNI field.
 *
 * The returned value is valid until rustls_accepted_into_connection or
 * rustls_accepted_free is called on the same `accepted`. It is not owned
 * by the caller and does not need to be freed.
 *
 * This will be a zero-length rustls_str in these error cases:
 *
 *  - The SNI contains a NUL byte.
 *  - The `accepted` parameter was NULL.
 *  - The `accepted` parameter was already transformed into a connection
 *      with rustls_accepted_into_connection.
 */
struct rustls_str rustls_accepted_server_name(const struct rustls_accepted *accepted);

/**
 * Get the i'th in the list of signature schemes offered in the ClientHello.
 * This is useful in selecting a server certificate when there are multiple
 * available for the same server name, for instance when selecting
 * between an RSA and an ECDSA certificate.
 *
 * Parameters:
 *
 * accepted: The rustls_accepted to access.
 * i: Fetch the signature scheme at this offset.
 *
 * Returns:
 *
 * A TLS Signature Scheme from <https://www.iana.org/assignments/tls-parameters/tls-parameters.xhtml#tls-signaturescheme>
 *
 * This will be 0 in these cases:
 *   - i is greater than the number of available cipher suites.
 *   - accepted is NULL.
 *   - rustls_accepted_into_connection has already been called with `accepted`.
 */
uint16_t rustls_accepted_signature_scheme(const struct rustls_accepted *accepted,
                                          size_t i);

/**
 * Get the i'th in the list of cipher suites offered in the ClientHello.
 *
 * Parameters:
 *
 * accepted: The rustls_accepted to access.
 * i: Fetch the cipher suite at this offset.
 *
 * Returns:
 *
 * A cipher suite value from <https://www.iana.org/assignments/tls-parameters/tls-parameters.xhtml#tls-parameters-4.>
 *
 * This will be 0 in these cases:
 *   - i is greater than the number of available cipher suites.
 *   - accepted is NULL.
 *   - rustls_accepted_into_connection has already been called with `accepted`.
 *
 * Note that 0 is technically a valid cipher suite "TLS_NULL_WITH_NULL_NULL",
 * but this library will never support null ciphers.
 */
uint16_t rustls_accepted_cipher_suite(const struct rustls_accepted *accepted,
                                      size_t i);

/**
 * Get the i'th in the list of ALPN protocols requested in the ClientHello.
 *
 * accepted: The rustls_accepted to access.
 * i: Fetch the ALPN value at this offset.
 *
 * Returns:
 *
 * A rustls_slice_bytes containing the i'th ALPN protocol. This may
 * contain internal NUL bytes and is not guaranteed to contain valid
 * UTF-8.
 *
 * This will be a zero-length rustls_slice bytes in these cases:
 *   - i is greater than the number of offered ALPN protocols.
 *   - The client did not offer the ALPN extension.
 *   - The `accepted` parameter was already transformed into a connection
 *      with rustls_accepted_into_connection.
 *
 * The returned value is valid until rustls_accepted_into_connection or
 * rustls_accepted_free is called on the same `accepted`. It is not owned
 * by the caller and does not need to be freed.
 *
 * If you are calling this from Rust, note that the `'static` lifetime
 * in the return signature is fake and must not be relied upon.
 */
struct rustls_slice_bytes rustls_accepted_alpn(const struct rustls_accepted *accepted, size_t i);

/**
 * Turn a rustls_accepted into a rustls_connection, given the provided
 * rustls_server_config.
 *
 * Parameters:
 *
 * accepted: The rustls_accepted to transform.
 * config: The configuration with which to create this connection.
 * out_conn: An output parameter. The pointed-to pointer will be set
 *   to a new rustls_connection only when the function returns
 *   RUSTLS_RESULT_OK.
 *
 * Returns:
 *
 * - RUSTLS_RESULT_OK: The `accepted` parameter was successfully
 *   transformed into a rustls_connection, and *out_conn was written to.
 * - RUSTLS_RESULT_ALREADY_USED: This function was called twice on the
 *   same rustls_connection.
 * - RUSTLS_RESULT_NULL_PARAMETER: One of the input parameters was NULL.
 *
 * Memory and lifetimes:
 *
 * In both success and failure cases, this consumes the contents of
 * `accepted` but does not free its allocated memory. In either case,
 * call rustls_accepted_free to avoid a memory leak.
 *
 * Calling accessor methods on an `accepted` after consuming it will
 * return zero or default values.
 *
 * The rustls_connection emitted by this function in the success case
 * is owned by the caller and must eventually be freed.
 *
 * This function does not take ownership of `config`. It does increment
 * `config`'s internal reference count, indicating that the
 * rustls_connection may hold a reference to it until it is done.
 * See the documentation for rustls_connection for details.
 */
rustls_result rustls_accepted_into_connection(struct rustls_accepted *accepted,
                                              const struct rustls_server_config *config,
                                              struct rustls_connection **out_conn);

/**
 * Free a rustls_accepted.
 *
 * Parameters:
 *
 * accepted: The rustls_accepted to free.
 *
 * Calling with NULL is fine. Must not be called twice with the same value.
 */
void rustls_accepted_free(struct rustls_accepted *accepted);

/**
 * Get the DER data of the certificate itself.
 * The data is owned by the certificate and has the same lifetime.
 */
rustls_result rustls_certificate_get_der(const struct rustls_certificate *cert,
                                         const uint8_t **out_der_data,
                                         size_t *out_der_len);

/**
 * Return a 16-bit unsigned integer corresponding to this cipher suite's assignment from
 * <https://www.iana.org/assignments/tls-parameters/tls-parameters.xhtml#tls-parameters-4>.
 * The bytes from the assignment are interpreted in network order.
 */
uint16_t rustls_supported_ciphersuite_get_suite(const struct rustls_supported_ciphersuite *supported_ciphersuite);

/**
 * Returns the name of the ciphersuite as a `rustls_str`. If the provided
 * ciphersuite is invalid, the rustls_str will contain the empty string. The
 * lifetime of the `rustls_str` is the lifetime of the program, it does not
 * need to be freed.
 */
struct rustls_str rustls_supported_ciphersuite_get_name(const struct rustls_supported_ciphersuite *supported_ciphersuite);

/**
 * Return the length of rustls' list of supported cipher suites.
 */
size_t rustls_all_ciphersuites_len(void);

/**
 * Get a pointer to a member of rustls' list of supported cipher suites. This will return non-NULL
 * for i < rustls_all_ciphersuites_len().
 * The returned pointer is valid for the lifetime of the program and may be used directly when
 * building a ClientConfig or ServerConfig.
 */
const struct rustls_supported_ciphersuite *rustls_all_ciphersuites_get_entry(size_t i);

/**
 * Return the length of rustls' list of default cipher suites.
 */
size_t rustls_default_ciphersuites_len(void);

/**
 * Get a pointer to a member of rustls' list of supported cipher suites. This will return non-NULL
 * for i < rustls_default_ciphersuites_len().
 * The returned pointer is valid for the lifetime of the program and may be used directly when
 * building a ClientConfig or ServerConfig.
 */
const struct rustls_supported_ciphersuite *rustls_default_ciphersuites_get_entry(size_t i);

/**
 * Build a `rustls_certified_key` from a certificate chain and a private key.
 * `cert_chain` must point to a buffer of `cert_chain_len` bytes, containing
 * a series of PEM-encoded certificates, with the end-entity (leaf)
 * certificate first.
 *
 * `private_key` must point to a buffer of `private_key_len` bytes, containing
 * a PEM-encoded private key in either PKCS#1 or PKCS#8 format.
 *
 * On success, this writes a pointer to the newly created
 * `rustls_certified_key` in `certified_key_out`. That pointer must later
 * be freed with `rustls_certified_key_free` to avoid memory leaks. Note that
 * internally, this is an atomically reference-counted pointer, so even after
 * the original caller has called `rustls_certified_key_free`, other objects
 * may retain a pointer to the object. The memory will be freed when all
 * references are gone.
 *
 * This function does not take ownership of any of its input pointers. It
 * parses the pointed-to data and makes a copy of the result. You may
 * free the cert_chain and private_key pointers after calling it.
 *
 * Typically, you will build a `rustls_certified_key`, use it to create a
 * `rustls_server_config` (which increments the reference count), and then
 * immediately call `rustls_certified_key_free`. That leaves the
 * `rustls_server_config` in possession of the sole reference, so the
 * `rustls_certified_key`'s memory will automatically be released when
 * the `rustls_server_config` is freed.
 */
rustls_result rustls_certified_key_build(const uint8_t *cert_chain,
                                         size_t cert_chain_len,
                                         const uint8_t *private_key,
                                         size_t private_key_len,
                                         const struct rustls_certified_key **certified_key_out);

/**
 * Return the i-th rustls_certificate in the rustls_certified_key. 0 gives the
 * end-entity certificate. 1 and higher give certificates from the chain.
 * Indexes higher than the last available certificate return NULL.
 *
 * The returned certificate is valid until the rustls_certified_key is freed.
 */
const struct rustls_certificate *rustls_certified_key_get_certificate(const struct rustls_certified_key *certified_key,
                                                                      size_t i);

/**
 * Create a copy of the rustls_certified_key with the given OCSP response data
 * as DER encoded bytes. The OCSP response may be given as NULL to clear any
 * possibly present OCSP data from the cloned key.
 * The cloned key is independent from its original and needs to be freed
 * by the application.
 */
rustls_result rustls_certified_key_clone_with_ocsp(const struct rustls_certified_key *certified_key,
                                                   const struct rustls_slice_bytes *ocsp_response,
                                                   const struct rustls_certified_key **cloned_key_out);

/**
 * "Free" a certified_key previously returned from
 * rustls_certified_key_build. Since certified_key is actually an
 * atomically reference-counted pointer, extant certified_key may still
 * hold an internal reference to the Rust object. However, C code must
 * consider this pointer unusable after "free"ing it.
 * Calling with NULL is fine. Must not be called twice with the same value.
 */
void rustls_certified_key_free(const struct rustls_certified_key *key);

/**
 * Create a `rustls_root_cert_store_builder`.
 *
 * Caller owns the memory and may free it with `rustls_root_cert_store_free`, regardless of
 * whether `rustls_root_cert_store_builder_build` was called.
 *
 * If you wish to abandon the builder without calling `rustls_root_cert_store_builder_build`,
 * it must be freed with `rustls_root_cert_store_builder_free`.
 */
struct rustls_root_cert_store_builder *rustls_root_cert_store_builder_new(void);

/**
 * Add one or more certificates to the root cert store builder using PEM
 * encoded data.
 *
 * When `strict` is true an error will return a `CertificateParseError`
 * result. So will an attempt to parse data that has zero certificates.
 *
 * When `strict` is false, unparseable root certificates will be ignored.
 * This may be useful on systems that have syntactically invalid root
 * certificates.
 */
rustls_result rustls_root_cert_store_builder_add_pem(struct rustls_root_cert_store_builder *builder,
                                                     const uint8_t *pem,
                                                     size_t pem_len,
                                                     bool strict);

/**
 * Add one or more certificates to the root cert store builder using PEM
 * encoded data read from a provided buffer
 *
 * When `strict` is true an error will return a `CertificateParseError`
 * result. So will an attempt to parse data that has zero certificates.
 *
 * When `strict` is false, unparseable root certificates will be ignored.
 * This may be useful on systems that have syntactically invalid root
 * certificates.
 */
rustls_result rustls_root_cert_store_builder_load_roots_from_bytes(struct rustls_root_cert_store_builder *builder,
                                                                   uint8_t *buf,
                                                                   size_t count,
                                                                   bool strict);

/**
 * Add one or more certificates to the root cert store builder using PEM
 * encoded data read from the named file.
 *
 * When `strict` is true an error will return a `CertificateParseError`
 * result. So will an attempt to parse data that has zero certificates.
 *
 * When `strict` is false, unparseable root certificates will be ignored.
 * This may be useful on systems that have syntactically invalid root
 * certificates.
 */
rustls_result rustls_root_cert_store_builder_load_roots_from_file(struct rustls_root_cert_store_builder *builder,
                                                                  const char *filename,
                                                                  bool strict);

/**
 * Create a new `rustls_root_cert_store` from the builder.
 *
 * The builder is consumed and cannot be used again, but must still be freed.
 *
 * The root cert store can be used in several `rustls_web_pki_client_cert_verifier_builder_new`
 * instances and must be freed by the application when no longer needed. See the documentation of
 * `rustls_root_cert_store_free` for details about lifetime.
 */
rustls_result rustls_root_cert_store_builder_build(struct rustls_root_cert_store_builder *builder,
                                                   const struct rustls_root_cert_store **root_cert_store_out);

/**
 * Free a `rustls_root_cert_store_builder` previously returned from
 * `rustls_root_cert_store_builder_new`. Calling with NULL is fine. Must not be
 * called twice with the same value.
 */
void rustls_root_cert_store_builder_free(struct rustls_root_cert_store_builder *builder);

/**
 * Free a rustls_root_cert_store previously returned from rustls_root_cert_store_builder_build.
 * Calling with NULL is fine. Must not be called twice with the same value.
 */
void rustls_root_cert_store_free(const struct rustls_root_cert_store *store);

/**
 * Free a `rustls_client_cert_verifier` previously returned from
 * `rustls_client_cert_verifier_builder_build`. Calling with NULL is fine. Must not be
 * called twice with the same value.
 */
void rustls_client_cert_verifier_free(struct rustls_client_cert_verifier *verifier);

/**
 * Create a `rustls_web_pki_client_cert_verifier_builder`. Caller owns the memory and may
 * eventually call `rustls_web_pki_client_cert_verifier_builder_free` to free it, whether or
 * not `rustls_web_pki_client_cert_verifier_builder_build` was called.
 *
 * Without further modification the builder will produce a client certificate verifier that
 * will require a client present a client certificate that chains to one of the trust anchors
 * in the provided `rustls_root_cert_store`. The root cert store must not be empty.
 *
 * Revocation checking will not be performed unless
 * `rustls_web_pki_client_cert_verifier_builder_add_crl` is used to add certificate revocation
 * lists (CRLs) to the builder. If CRLs are added, revocation checking will be performed
 * for the entire certificate chain unless
 * `rustls_web_pki_client_cert_verifier_only_check_end_entity_revocation` is used. Unknown
 * revocation status for certificates considered for revocation status will be treated as
 * an error unless `rustls_web_pki_client_cert_verifier_allow_unknown_revocation_status` is
 * used.
 *
 * Unauthenticated clients will not be permitted unless
 * `rustls_web_pki_client_cert_verifier_builder_allow_unauthenticated` is used.
 *
 * This copies the contents of the `rustls_root_cert_store`. It does not take
 * ownership of the pointed-to data.
 */
struct rustls_web_pki_client_cert_verifier_builder *rustls_web_pki_client_cert_verifier_builder_new(const struct rustls_root_cert_store *store);

/**
 * Add one or more certificate revocation lists (CRLs) to the client certificate verifier
 * builder by reading the CRL content from the provided buffer of PEM encoded content.
 *
 * By default revocation checking will be performed on the entire certificate chain. To only
 * check the revocation status of the end entity certificate, use
 * `rustls_web_pki_client_cert_verifier_only_check_end_entity_revocation`.
 *
 * This function returns an error if the provided buffer is not valid PEM encoded content.
 */
rustls_result rustls_web_pki_client_cert_verifier_builder_add_crl(struct rustls_web_pki_client_cert_verifier_builder *builder,
                                                                  const uint8_t *crl_pem,
                                                                  size_t crl_pem_len);

/**
 * When CRLs are provided with `rustls_web_pki_client_cert_verifier_builder_add_crl`, only
 * check the revocation status of end entity certificates, ignoring any intermediate certificates
 * in the chain.
 */
rustls_result rustls_web_pki_client_cert_verifier_only_check_end_entity_revocation(struct rustls_web_pki_client_cert_verifier_builder *builder);

/**
 * When CRLs are provided with `rustls_web_pki_client_cert_verifier_builder_add_crl`, and it
 * isn't possible to determine the revocation status of a considered certificate, do not treat
 * it as an error condition.
 *
 * Overrides the default behavior where unknown revocation status is considered an error.
 */
rustls_result rustls_web_pki_client_cert_verifier_allow_unknown_revocation_status(struct rustls_web_pki_client_cert_verifier_builder *builder);

/**
 * Allow unauthenticated anonymous clients in addition to those that present a client
 * certificate that chains to one of the verifier's configured trust anchors.
 */
rustls_result rustls_web_pki_client_cert_verifier_builder_allow_unauthenticated(struct rustls_web_pki_client_cert_verifier_builder *builder);

/**
 * Clear the list of trust anchor hint subjects.
 *
 * By default, the client cert verifier will use the subjects provided by the root cert
 * store configured for client authentication. Calling this function will remove these
 * hint subjects, indicating the client should make a free choice of which certificate
 * to send.
 */
rustls_result rustls_web_pki_client_cert_verifier_clear_root_hint_subjects(struct rustls_web_pki_client_cert_verifier_builder *builder);

/**
 * Add additional distinguished names to the list of trust anchor hint subjects.
 *
 * By default, the client cert verifier will use the subjects provided by the root cert
 * store configured for client authentication. Calling this function will add to these
 * existing hint subjects. Calling this function with an empty `store` will have no
 * effect, use `rustls_web_pki_client_cert_verifier_clear_root_hint_subjects` to clear
 * the subject hints.
 */
rustls_result rustls_web_pki_client_cert_verifier_add_root_hint_subjects(struct rustls_web_pki_client_cert_verifier_builder *builder,
                                                                         const struct rustls_root_cert_store *store);

/**
 * Create a new client certificate verifier from the builder.
 *
 * The builder is consumed and cannot be used again, but must still be freed.
 *
 * The verifier can be used in several `rustls_server_config` instances and must be
 * freed by the application when no longer needed. See the documentation of
 * `rustls_web_pki_client_cert_verifier_builder_free` for details about lifetime.
 */
rustls_result rustls_web_pki_client_cert_verifier_builder_build(struct rustls_web_pki_client_cert_verifier_builder *builder,
                                                                struct rustls_client_cert_verifier **verifier_out);

/**
 * Free a `rustls_client_cert_verifier_builder` previously returned from
 * `rustls_client_cert_verifier_builder_new`. Calling with NULL is fine. Must not be
 * called twice with the same value.
 */
void rustls_web_pki_client_cert_verifier_builder_free(struct rustls_web_pki_client_cert_verifier_builder *builder);

/**
 * Create a `rustls_web_pki_server_cert_verifier_builder`. Caller owns the memory and may
 * free it with `rustls_web_pki_server_cert_verifier_builder_free`, regardless of whether
 * `rustls_web_pki_server_cert_verifier_builder_build` was called.
 *
 * Without further modification the builder will produce a server certificate verifier that
 * will require a server present a certificate that chains to one of the trust anchors
 * in the provided `rustls_root_cert_store`. The root cert store must not be empty.
 *
 * Revocation checking will not be performed unless
 * `rustls_web_pki_server_cert_verifier_builder_add_crl` is used to add certificate revocation
 * lists (CRLs) to the builder.  If CRLs are added, revocation checking will be performed
 * for the entire certificate chain unless
 * `rustls_web_pki_server_cert_verifier_only_check_end_entity_revocation` is used. Unknown
 * revocation status for certificates considered for revocation status will be treated as
 * an error unless `rustls_web_pki_server_cert_verifier_allow_unknown_revocation_status` is
 * used.
 *
 * This copies the contents of the `rustls_root_cert_store`. It does not take
 * ownership of the pointed-to data.
 */
struct rustls_web_pki_server_cert_verifier_builder *rustls_web_pki_server_cert_verifier_builder_new(const struct rustls_root_cert_store *store);

/**
 * Add one or more certificate revocation lists (CRLs) to the server certificate verifier
 * builder by reading the CRL content from the provided buffer of PEM encoded content.
 *
 * By default revocation checking will be performed on the entire certificate chain. To only
 * check the revocation status of the end entity certificate, use
 * `rustls_web_pki_server_cert_verifier_only_check_end_entity_revocation`.
 *
 * This function returns an error if the provided buffer is not valid PEM encoded content.
 */
rustls_result rustls_web_pki_server_cert_verifier_builder_add_crl(struct rustls_web_pki_server_cert_verifier_builder *builder,
                                                                  const uint8_t *crl_pem,
                                                                  size_t crl_pem_len);

/**
 * When CRLs are provided with `rustls_web_pki_server_cert_verifier_builder_add_crl`, only
 * check the revocation status of end entity certificates, ignoring any intermediate certificates
 * in the chain.
 */
rustls_result rustls_web_pki_server_cert_verifier_only_check_end_entity_revocation(struct rustls_web_pki_server_cert_verifier_builder *builder);

/**
 * When CRLs are provided with `rustls_web_pki_server_cert_verifier_builder_add_crl`, and it
 * isn't possible to determine the revocation status of a considered certificate, do not treat
 * it as an error condition.
 *
 * Overrides the default behavior where unknown revocation status is considered an error.
 */
rustls_result rustls_web_pki_server_cert_verifier_allow_unknown_revocation_status(struct rustls_web_pki_server_cert_verifier_builder *builder);

/**
 * Create a new server certificate verifier from the builder.
 *
 * The builder is consumed and cannot be used again, but must still be freed.
 *
 * The verifier can be used in several `rustls_client_config` instances and must be
 * freed by the application when no longer needed. See the documentation of
 * `rustls_web_pki_server_cert_verifier_builder_free` for details about lifetime.
 */
rustls_result rustls_web_pki_server_cert_verifier_builder_build(struct rustls_web_pki_server_cert_verifier_builder *builder,
                                                                struct rustls_server_cert_verifier **verifier_out);

/**
 * Free a `rustls_server_cert_verifier_builder` previously returned from
 * `rustls_server_cert_verifier_builder_new`. Calling with NULL is fine. Must not be
 * called twice with the same value.
 */
void rustls_web_pki_server_cert_verifier_builder_free(struct rustls_web_pki_server_cert_verifier_builder *builder);

/**
 * Free a `rustls_server_cert_verifier` previously returned from
 * `rustls_server_cert_verifier_builder_build`. Calling with NULL is fine. Must not be
 * called twice with the same value.
 */
void rustls_server_cert_verifier_free(struct rustls_server_cert_verifier *verifier);

/**
 * Create a rustls_client_config_builder. Caller owns the memory and must
 * eventually call rustls_client_config_builder_build, then free the
 * resulting rustls_client_config.
 * This uses rustls safe default values
 * for the cipher suites, key exchange groups and protocol versions.
 * This starts out with no trusted roots.
 * Caller must add roots with rustls_client_config_builder_load_roots_from_file
 * or provide a custom verifier.
 */
struct rustls_client_config_builder *rustls_client_config_builder_new(void);

/**
 * Create a rustls_client_config_builder. Caller owns the memory and must
 * eventually call rustls_client_config_builder_build, then free the
 * resulting rustls_client_config. Specify cipher suites in preference
 * order; the `cipher_suites` parameter must point to an array containing
 * `len` pointers to `rustls_supported_ciphersuite` previously obtained
 * from `rustls_all_ciphersuites_get_entry()`, or to a provided array,
 * RUSTLS_DEFAULT_CIPHER_SUITES or RUSTLS_ALL_CIPHER_SUITES. Set the TLS
 * protocol versions to use when negotiating a TLS session.
 *
 * `tls_version` is the version of the protocol, as defined in rfc8446,
 * ch. 4.2.1 and end of ch. 5.1. Some values are defined in
 * `rustls_tls_version` for convenience, and the arrays
 * RUSTLS_DEFAULT_VERSIONS or RUSTLS_ALL_VERSIONS can be used directly.
 *
 * `versions` will only be used during the call and the application retains
 * ownership. `len` is the number of consecutive `uint16_t` pointed to by `versions`.
 */
rustls_result rustls_client_config_builder_new_custom(const struct rustls_supported_ciphersuite *const *cipher_suites,
                                                      size_t cipher_suites_len,
                                                      const uint16_t *tls_versions,
                                                      size_t tls_versions_len,
                                                      struct rustls_client_config_builder **builder_out);

/**
 * Set a custom server certificate verifier.
 *
 * The callback must not capture any of the pointers in its
 * rustls_verify_server_cert_params.
 * If `userdata` has been set with rustls_connection_set_userdata, it
 * will be passed to the callback. Otherwise the userdata param passed to
 * the callback will be NULL.
 *
 * The callback must be safe to call on any thread at any time, including
 * multiple concurrent calls. So, for instance, if the callback mutates
 * userdata (or other shared state), it must use synchronization primitives
 * to make such mutation safe.
 *
 * The callback receives certificate chain information as raw bytes.
 * Currently this library offers no functions to parse the certificates,
 * so you'll need to bring your own certificate parsing library
 * if you need to parse them.
 *
 * If the custom verifier accepts the certificate, it should return
 * RUSTLS_RESULT_OK. Otherwise, it may return any other rustls_result error.
 * Feel free to use an appropriate error from the RUSTLS_RESULT_CERT_*
 * section.
 *
 * <https://docs.rs/rustls/latest/rustls/client/struct.DangerousClientConfig.html#method.set_certificate_verifier>
 */
rustls_result rustls_client_config_builder_dangerous_set_certificate_verifier(struct rustls_client_config_builder *config_builder,
                                                                              rustls_verify_server_cert_callback callback);

/**
 * Configure the server certificate verifier.
 *
 * This increases the reference count of `verifier` and does not take ownership.
 */
void rustls_client_config_builder_set_server_verifier(struct rustls_client_config_builder *builder,
                                                      const struct rustls_server_cert_verifier *verifier);

/**
 * Set the ALPN protocol list to the given protocols. `protocols` must point
 * to a buffer of `rustls_slice_bytes` (built by the caller) with `len`
 * elements. Each element of the buffer must be a rustls_slice_bytes whose
 * data field points to a single ALPN protocol ID. Standard ALPN protocol
 * IDs are defined at
 * <https://www.iana.org/assignments/tls-extensiontype-values/tls-extensiontype-values.xhtml#alpn-protocol-ids>.
 *
 * This function makes a copy of the data in `protocols` and does not retain
 * any pointers, so the caller can free the pointed-to memory after calling.
 *
 * <https://docs.rs/rustls/latest/rustls/client/struct.ClientConfig.html#structfield.alpn_protocols>
 */
rustls_result rustls_client_config_builder_set_alpn_protocols(struct rustls_client_config_builder *builder,
                                                              const struct rustls_slice_bytes *protocols,
                                                              size_t len);

/**
 * Enable or disable SNI.
 * <https://docs.rs/rustls/latest/rustls/struct.ClientConfig.html#structfield.enable_sni>
 */
void rustls_client_config_builder_set_enable_sni(struct rustls_client_config_builder *config,
                                                 bool enable);

/**
 * Provide the configuration a list of certificates where the connection
 * will select the first one that is compatible with the server's signature
 * verification capabilities. Clients that want to support both ECDSA and
 * RSA certificates will want the ECSDA to go first in the list.
 *
 * The built configuration will keep a reference to all certified keys
 * provided. The client may `rustls_certified_key_free()` afterwards
 * without the configuration losing them. The same certified key may also
 * be used in multiple configs.
 *
 * EXPERIMENTAL: installing a client authentication callback will replace any
 * configured certified keys and vice versa.
 */
rustls_result rustls_client_config_builder_set_certified_key(struct rustls_client_config_builder *builder,
                                                             const struct rustls_certified_key *const *certified_keys,
                                                             size_t certified_keys_len);

/**
 * Turn a *rustls_client_config_builder (mutable) into a const *rustls_client_config
 * (read-only).
 */
const struct rustls_client_config *rustls_client_config_builder_build(struct rustls_client_config_builder *builder);

/**
 * "Free" a client_config_builder without building it into a rustls_client_config.
 * Normally builders are built into rustls_client_config via `rustls_client_config_builder_build`
 * and may not be free'd or otherwise used afterwards.
 * Use free only when the building of a config has to be aborted before a config
 * was created.
 */
void rustls_client_config_builder_free(struct rustls_client_config_builder *config);

/**
 * "Free" a rustls_client_config previously returned from
 * rustls_client_config_builder_build. Since rustls_client_config is actually an
 * atomically reference-counted pointer, extant client connections may still
 * hold an internal reference to the Rust object. However, C code must
 * consider this pointer unusable after "free"ing it.
 * Calling with NULL is fine. Must not be called twice with the same value.
 */
void rustls_client_config_free(const struct rustls_client_config *config);

/**
 * Create a new rustls_connection containing a client connection and return
 * it in the output parameter `out`. If this returns an error code, the
 * memory pointed to by `conn_out` remains unchanged. If this returns a
 * non-error, the memory pointed to by `conn_out` is modified to point at a
 * valid rustls_connection. The caller now owns the rustls_connection and must
 * call `rustls_connection_free` when done with it.
 *
 * The server_name parameter can contain a hostname or an IP address in
 * textual form (IPv4 or IPv6). This function will return an error if it
 * cannot be parsed as one of those types.
 */
rustls_result rustls_client_connection_new(const struct rustls_client_config *config,
                                           const char *server_name,
                                           struct rustls_connection **conn_out);

/**
 * Set the userdata pointer associated with this connection. This will be passed
 * to any callbacks invoked by the connection, if you've set up callbacks in the config.
 * The pointed-to data must outlive the connection.
 */
void rustls_connection_set_userdata(struct rustls_connection *conn, void *userdata);

/**
 * Set the logging callback for this connection. The log callback will be invoked
 * with the userdata parameter previously set by rustls_connection_set_userdata, or
 * NULL if no userdata was set.
 */
void rustls_connection_set_log_callback(struct rustls_connection *conn, rustls_log_callback cb);

/**
 * Read some TLS bytes from the provided file descriptor into internal buffers.
 * Returns 0 for success, or an errno value on error.
 * <https://docs.rs/rustls/latest/rustls/enum.Connection.html#method.read_tls>
 */
rustls_io_result rustls_connection_read_tls_from_fd(struct rustls_connection *conn,
                                                    int32_t fd,
                                                    size_t *out_n);

/**
 * Read some TLS bytes from the network into internal buffers. The actual network
 * I/O is performed by `callback`, which you provide. Rustls will invoke your
 * callback with a suitable buffer to store the read bytes into. You don't have
 * to fill it up, just fill with as many bytes as you get in one syscall.
 * The `userdata` parameter is passed through directly to `callback`. Note that
 * this is distinct from the `userdata` parameter set with
 * `rustls_connection_set_userdata`.
 * Returns 0 for success, or an errno value on error. Passes through return values
 * from callback. See rustls_read_callback for more details.
 * <https://docs.rs/rustls/latest/rustls/enum.Connection.html#method.read_tls>
 */
rustls_io_result rustls_connection_read_tls(struct rustls_connection *conn,
                                            rustls_read_callback callback,
                                            void *userdata,
                                            size_t *out_n);

/**
 * Write some TLS bytes to provided file descriptor.
 * Returns 0 for success, or an errno value on error.
 * <https://docs.rs/rustls/latest/rustls/enum.Connection.html#method.write_tls>
 */
rustls_io_result rustls_connection_write_tls_to_fd(struct rustls_connection *conn,
                                                   int32_t fd,
                                                   size_t *out_n);

/**
 * Write some TLS bytes to the network. The actual network I/O is performed by
 * `callback`, which you provide. Rustls will invoke your callback with a
 * suitable buffer containing TLS bytes to send. You don't have to write them
 * all, just as many as you can in one syscall.
 * The `userdata` parameter is passed through directly to `callback`. Note that
 * this is distinct from the `userdata` parameter set with
 * `rustls_connection_set_userdata`.
 * Returns 0 for success, or an errno value on error. Passes through return values
 * from callback. See rustls_write_callback for more details.
 * <https://docs.rs/rustls/latest/rustls/enum.Connection.html#method.write_tls>
 */
rustls_io_result rustls_connection_write_tls(struct rustls_connection *conn,
                                             rustls_write_callback callback,
                                             void *userdata,
                                             size_t *out_n);

/**
 * Write all available TLS bytes to the network. The actual network I/O is performed by
 * `callback`, which you provide. Rustls will invoke your callback with an array
 * of rustls_slice_bytes, each containing a buffer with TLS bytes to send.
 * You don't have to write them all, just as many as you are willing.
 * The `userdata` parameter is passed through directly to `callback`. Note that
 * this is distinct from the `userdata` parameter set with
 * `rustls_connection_set_userdata`.
 * Returns 0 for success, or an errno value on error. Passes through return values
 * from callback. See rustls_write_callback for more details.
 * <https://docs.rs/rustls/latest/rustls/struct.Writer.html#method.write_vectored>
 */
rustls_io_result rustls_connection_write_tls_vectored(struct rustls_connection *conn,
                                                      rustls_write_vectored_callback callback,
                                                      void *userdata,
                                                      size_t *out_n);

/**
 * Decrypt any available ciphertext from the internal buffer and put it
 * into the internal plaintext buffer, potentially making bytes available
 * for rustls_connection_read().
 * <https://docs.rs/rustls/latest/rustls/enum.Connection.html#method.process_new_packets>
 */
rustls_result rustls_connection_process_new_packets(struct rustls_connection *conn);

/**
 * <https://docs.rs/rustls/latest/rustls/struct.CommonState.html#method.wants_read>
 */
bool rustls_connection_wants_read(const struct rustls_connection *conn);

/**
 * <https://docs.rs/rustls/latest/rustls/struct.CommonState.html#method.wants_write>
 */
bool rustls_connection_wants_write(const struct rustls_connection *conn);

/**
 * <https://docs.rs/rustls/latest/rustls/struct.CommonState.html#method.is_handshaking>
 */
bool rustls_connection_is_handshaking(const struct rustls_connection *conn);

/**
 * Sets a limit on the internal buffers used to buffer unsent plaintext (prior
 * to completing the TLS handshake) and unsent TLS records. By default, there
 * is no limit. The limit can be set at any time, even if the current buffer
 * use is higher.
 * <https://docs.rs/rustls/latest/rustls/enum.Connection.html#method.set_buffer_limit>
 */
void rustls_connection_set_buffer_limit(struct rustls_connection *conn, size_t n);

/**
 * Queues a close_notify fatal alert to be sent in the next write_tls call.
 * <https://docs.rs/rustls/latest/rustls/enum.Connection.html#method.send_close_notify>
 */
void rustls_connection_send_close_notify(struct rustls_connection *conn);

/**
 * Return the i-th certificate provided by the peer.
 * Index 0 is the end entity certificate. Higher indexes are certificates
 * in the chain. Requesting an index higher than what is available returns
 * NULL.
 * The returned pointer is valid until the next mutating function call
 * affecting the connection. A mutating function call is one where the
 * first argument has type `struct rustls_connection *` (as opposed to
 *  `const struct rustls_connection *`).
 * <https://docs.rs/rustls/latest/rustls/enum.Connection.html#method.peer_certificates>
 */
const struct rustls_certificate *rustls_connection_get_peer_certificate(const struct rustls_connection *conn,
                                                                        size_t i);

/**
 * Get the ALPN protocol that was negotiated, if any. Stores a pointer to a
 * borrowed buffer of bytes, and that buffer's len, in the output parameters.
 * The borrow lives as long as the connection.
 * If the connection is still handshaking, or no ALPN protocol was negotiated,
 * stores NULL and 0 in the output parameters.
 * The provided pointer is valid until the next mutating function call
 * affecting the connection. A mutating function call is one where the
 * first argument has type `struct rustls_connection *` (as opposed to
 *  `const struct rustls_connection *`).
 * <https://www.iana.org/assignments/tls-parameters/>
 * <https://docs.rs/rustls/latest/rustls/enum.Connection.html#method.alpn_protocol>
 */
void rustls_connection_get_alpn_protocol(const struct rustls_connection *conn,
                                         const uint8_t **protocol_out,
                                         size_t *protocol_out_len);

/**
 * Return the TLS protocol version that has been negotiated. Before this
 * has been decided during the handshake, this will return 0. Otherwise,
 * the u16 version number as defined in the relevant RFC is returned.
 * <https://docs.rs/rustls/latest/rustls/enum.Connection.html#method.protocol_version>
 * <https://docs.rs/rustls/latest/rustls/internal/msgs/enums/enum.ProtocolVersion.html>
 */
uint16_t rustls_connection_get_protocol_version(const struct rustls_connection *conn);

/**
 * Retrieves the cipher suite agreed with the peer.
 * This returns NULL until the ciphersuite is agreed.
 * The returned pointer lives as long as the program.
 * <https://docs.rs/rustls/latest/rustls/enum.Connection.html#method.negotiated_cipher_suite>
 */
const struct rustls_supported_ciphersuite *rustls_connection_get_negotiated_ciphersuite(const struct rustls_connection *conn);

/**
 * Write up to `count` plaintext bytes from `buf` into the `rustls_connection`.
 * This will increase the number of output bytes available to
 * `rustls_connection_write_tls`.
 * On success, store the number of bytes actually written in *out_n
 * (this may be less than `count`).
 * <https://docs.rs/rustls/latest/rustls/struct.Writer.html#method.write>
 */
rustls_result rustls_connection_write(struct rustls_connection *conn,
                                      const uint8_t *buf,
                                      size_t count,
                                      size_t *out_n);

/**
 * Read up to `count` plaintext bytes from the `rustls_connection` into `buf`.
 * On success, store the number of bytes read in *out_n (this may be less
 * than `count`). A success with *out_n set to 0 means "all bytes currently
 * available have been read, but more bytes may become available after
 * subsequent calls to rustls_connection_read_tls and
 * rustls_connection_process_new_packets."
 *
 * Subtle note: Even though this function only writes to `buf` and does not
 * read from it, the memory in `buf` must be initialized before the call (for
 * Rust-internal reasons). Initializing a buffer once and then using it
 * multiple times without zeroizing before each call is fine.
 * <https://docs.rs/rustls/latest/rustls/struct.Reader.html#method.read>
 */
rustls_result rustls_connection_read(struct rustls_connection *conn,
                                     uint8_t *buf,
                                     size_t count,
                                     size_t *out_n);

#if defined(DEFINE_READ_BUF)
/**
 * Read up to `count` plaintext bytes from the `rustls_connection` into `buf`.
 * On success, store the number of bytes read in *out_n (this may be less
 * than `count`). A success with *out_n set to 0 means "all bytes currently
 * available have been read, but more bytes may become available after
 * subsequent calls to rustls_connection_read_tls and
 * rustls_connection_process_new_packets."
 *
 * This experimental API is only available when using a nightly Rust compiler
 * and enabling the `read_buf` Cargo feature. It will be deprecated and later
 * removed in future versions.
 *
 * Unlike with `rustls_connection_read`, this function may be called with `buf`
 * pointing to an uninitialized memory buffer.
 */
rustls_result rustls_connection_read_2(struct rustls_connection *conn,
                                       uint8_t *buf,
                                       size_t count,
                                       size_t *out_n);
#endif

/**
 * Free a rustls_connection. Calling with NULL is fine.
 * Must not be called twice with the same value.
 */
void rustls_connection_free(struct rustls_connection *conn);

/**
 * After a rustls function returns an error, you may call
 * this to get a pointer to a buffer containing a detailed error
 * message. The contents of the error buffer will be out_n bytes long,
 * UTF-8 encoded, and not NUL-terminated.
 */
void rustls_error(unsigned int result, char *buf, size_t len, size_t *out_n);

bool rustls_result_is_cert_error(unsigned int result);

/**
 * Return a rustls_str containing the stringified version of a log level.
 */
struct rustls_str rustls_log_level_str(rustls_log_level level);

/**
 * Return the length of the outer slice. If the input pointer is NULL,
 * returns 0.
 */
size_t rustls_slice_slice_bytes_len(const struct rustls_slice_slice_bytes *input);

/**
 * Retrieve the nth element from the input slice of slices. If the input
 * pointer is NULL, or n is greater than the length of the
 * rustls_slice_slice_bytes, returns rustls_slice_bytes{NULL, 0}.
 */
struct rustls_slice_bytes rustls_slice_slice_bytes_get(const struct rustls_slice_slice_bytes *input,
                                                       size_t n);

/**
 * Return the length of the outer slice. If the input pointer is NULL,
 * returns 0.
 */
size_t rustls_slice_str_len(const struct rustls_slice_str *input);

/**
 * Retrieve the nth element from the input slice of `&str`s. If the input
 * pointer is NULL, or n is greater than the length of the
 * rustls_slice_str, returns rustls_str{NULL, 0}.
 */
struct rustls_str rustls_slice_str_get(const struct rustls_slice_str *input, size_t n);

/**
 * Create a rustls_server_config_builder. Caller owns the memory and must
 * eventually call rustls_server_config_builder_build, then free the
 * resulting rustls_server_config. This uses rustls safe default values
 * for the cipher suites, key exchange groups and protocol versions.
 */
struct rustls_server_config_builder *rustls_server_config_builder_new(void);

/**
 * Create a rustls_server_config_builder. Caller owns the memory and must
 * eventually call rustls_server_config_builder_build, then free the
 * resulting rustls_server_config. Specify cipher suites in preference
 * order; the `cipher_suites` parameter must point to an array containing
 * `len` pointers to `rustls_supported_ciphersuite` previously obtained
 * from `rustls_all_ciphersuites_get_entry()`. Set the TLS protocol
 * versions to use when negotiating a TLS session.
 *
 * `tls_version` is the version of the protocol, as defined in rfc8446,
 * ch. 4.2.1 and end of ch. 5.1. Some values are defined in
 * `rustls_tls_version` for convenience.
 *
 * `versions` will only be used during the call and the application retains
 * ownership. `len` is the number of consecutive `uint16_t` pointed to by `versions`.
 */
rustls_result rustls_server_config_builder_new_custom(const struct rustls_supported_ciphersuite *const *cipher_suites,
                                                      size_t cipher_suites_len,
                                                      const uint16_t *tls_versions,
                                                      size_t tls_versions_len,
                                                      struct rustls_server_config_builder **builder_out);

/**
 * Create a rustls_server_config_builder for TLS sessions that may verify client
 * certificates. This increases the refcount of `verifier` and doesn't take ownership.
 */
void rustls_server_config_builder_set_client_verifier(struct rustls_server_config_builder *builder,
                                                      const struct rustls_client_cert_verifier *verifier);

/**
 * "Free" a server_config_builder without building it into a rustls_server_config.
 * Normally builders are built into rustls_server_configs via `rustls_server_config_builder_build`
 * and may not be free'd or otherwise used afterwards.
 * Use free only when the building of a config has to be aborted before a config
 * was created.
 */
void rustls_server_config_builder_free(struct rustls_server_config_builder *config);

/**
 * With `ignore` != 0, the server will ignore the client ordering of cipher
 * suites, aka preference, during handshake and respect its own ordering
 * as configured.
 * <https://docs.rs/rustls/latest/rustls/struct.ServerConfig.html#structfield.ignore_client_order>
 */
rustls_result rustls_server_config_builder_set_ignore_client_order(struct rustls_server_config_builder *builder,
                                                                   bool ignore);

/**
 * Set the ALPN protocol list to the given protocols. `protocols` must point
 * to a buffer of `rustls_slice_bytes` (built by the caller) with `len`
 * elements. Each element of the buffer must point to a slice of bytes that
 * contains a single ALPN protocol from
 * <https://www.iana.org/assignments/tls-extensiontype-values/tls-extensiontype-values.xhtml#alpn-protocol-ids>.
 *
 * This function makes a copy of the data in `protocols` and does not retain
 * any pointers, so the caller can free the pointed-to memory after calling.
 *
 * <https://docs.rs/rustls/latest/rustls/server/struct.ServerConfig.html#structfield.alpn_protocols>
 */
rustls_result rustls_server_config_builder_set_alpn_protocols(struct rustls_server_config_builder *builder,
                                                              const struct rustls_slice_bytes *protocols,
                                                              size_t len);

/**
 * Provide the configuration a list of certificates where the connection
 * will select the first one that is compatible with the client's signature
 * verification capabilities. Servers that want to support both ECDSA and
 * RSA certificates will want the ECSDA to go first in the list.
 *
 * The built configuration will keep a reference to all certified keys
 * provided. The client may `rustls_certified_key_free()` afterwards
 * without the configuration losing them. The same certified key may also
 * be used in multiple configs.
 *
 * EXPERIMENTAL: installing a client_hello callback will replace any
 * configured certified keys and vice versa.
 */
rustls_result rustls_server_config_builder_set_certified_keys(struct rustls_server_config_builder *builder,
                                                              const struct rustls_certified_key *const *certified_keys,
                                                              size_t certified_keys_len);

/**
 * Turn a *rustls_server_config_builder (mutable) into a const *rustls_server_config
 * (read-only).
 */
const struct rustls_server_config *rustls_server_config_builder_build(struct rustls_server_config_builder *builder);

/**
 * "Free" a rustls_server_config previously returned from
 * rustls_server_config_builder_build. Since rustls_server_config is actually an
 * atomically reference-counted pointer, extant server connections may still
 * hold an internal reference to the Rust object. However, C code must
 * consider this pointer unusable after "free"ing it.
 * Calling with NULL is fine. Must not be called twice with the same value.
 */
void rustls_server_config_free(const struct rustls_server_config *config);

/**
 * Create a new rustls_connection containing a server connection, and return it
 * in the output parameter `out`. If this returns an error code, the memory
 * pointed to by `conn_out` remains unchanged. If this returns a non-error,
 * the memory pointed to by `conn_out` is modified to point
 * at a valid rustls_connection. The caller now owns the rustls_connection
 * and must call `rustls_connection_free` when done with it.
 */
rustls_result rustls_server_connection_new(const struct rustls_server_config *config,
                                           struct rustls_connection **conn_out);

/**
 * Copy the server name from the server name indication (SNI) extension to `buf` which can
 * hold up  to `count` bytes, and the length of that server name in `out_n`. The string is
 * stored in UTF-8 with no terminating NUL byte.
 * Returns RUSTLS_RESULT_INSUFFICIENT_SIZE if the SNI hostname is longer than `count`.
 * Returns Ok with *out_n == 0 if there is no SNI hostname available on this connection
 * because it hasn't been processed yet, or because the client did not send SNI.
 * <https://docs.rs/rustls/latest/rustls/server/struct.ServerConnection.html#method.server_name>
 */
rustls_result rustls_server_connection_get_server_name(const struct rustls_connection *conn,
                                                       uint8_t *buf,
                                                       size_t count,
                                                       size_t *out_n);

/**
 * Register a callback to be invoked when a connection created from this config
 * sees a TLS ClientHello message. If `userdata` has been set with
 * rustls_connection_set_userdata, it will be passed to the callback.
 * Otherwise the userdata param passed to the callback will be NULL.
 *
 * Any existing `ResolvesServerCert` implementation currently installed in the
 * `rustls_server_config` will be replaced. This also means registering twice
 * will overwrite the first registration. It is not permitted to pass a NULL
 * value for `callback`.
 *
 * EXPERIMENTAL: this feature of rustls-ffi is likely to change in the future, as
 * the rustls library is re-evaluating their current approach to client hello handling.
 * Installing a client_hello callback will replace any configured certified keys
 * and vice versa. Same holds true for the set_certified_keys variant.
 */
rustls_result rustls_server_config_builder_set_hello_callback(struct rustls_server_config_builder *builder,
                                                              rustls_client_hello_callback callback);

/**
 * Select a `rustls_certified_key` from the list that matches the cryptographic
 * parameters of a TLS client hello. Note that this does not do any SNI matching.
 * The input certificates should already have been filtered to ones matching the
 * SNI from the client hello.
 *
 * This is intended for servers that are configured with several keys for the
 * same domain name(s), for example ECDSA and RSA types. The presented keys are
 * inspected in the order given and keys first in the list are given preference,
 * all else being equal. However rustls is free to choose whichever it considers
 * to be the best key with its knowledge about security issues and possible future
 * extensions of the protocol.
 *
 * Return RUSTLS_RESULT_OK if a key was selected and RUSTLS_RESULT_NOT_FOUND
 * if none was suitable.
 */
rustls_result rustls_client_hello_select_certified_key(const struct rustls_client_hello *hello,
                                                       const struct rustls_certified_key *const *certified_keys,
                                                       size_t certified_keys_len,
                                                       const struct rustls_certified_key **out_key);

/**
 * Register callbacks for persistence of TLS session IDs and secrets. Both
 * keys and values are highly sensitive data, containing enough information
 * to break the security of the connections involved.
 *
 * If `userdata` has been set with rustls_connection_set_userdata, it
 * will be passed to the callbacks. Otherwise the userdata param passed to
 * the callbacks will be NULL.
 */
rustls_result rustls_server_config_builder_set_persistence(struct rustls_server_config_builder *builder,
                                                           rustls_session_store_get_callback get_cb,
                                                           rustls_session_store_put_callback put_cb);

#ifdef __cplusplus
} // extern "C"
#endif // __cplusplus

#endif /* RUSTLS_H */
