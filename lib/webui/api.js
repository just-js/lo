const api = {
  webui_wait: {
    // void webui_wait(void)
    parameters: [],
    result: "void",
    nonblocking: true,
  },
  webui_new_window: {
    // size_t webui_new_window(void)
    parameters: [],
    result: "u32",
  },
  webui_show: {
    // u32 webui_show(size_t window, const char* content)
    parameters: ["u32", "buffer"],
    pointers: [, 'const char*'],
    result: "bool",
  },
  webui_show_browser: {
    // u32 webui_show_browser(size_t window, const char* content, size_t browser)
    parameters: ["u32", "string", "u32"],
    result: "u32",
  },
  webui_interface_bind: {
    // size_t webui_interface_bind(size_t window, const char* element, void (*func)(size_t, size_t, char*, size_t, size_t));
    parameters: ["u32", "string", "pointer"],
    pointers: [, , 'ui_callback'],
    result: "u32",
  },
  webui_script: {
    // u32 webui_script(size_t window, const char* script, size_t timeout, char* buffer, size_t buffer_length)
    parameters: ["u32", "string", "u32", "string", "u32"],
    casts: [, , , '(char*)'],
    result: "u32",
  },
  webui_run: {
    // void webui_run(size_t window, const char* script)
    parameters: ["u32", "string"],
    result: "void",
  },
  webui_interface_set_response: {
    // void webui_interface_set_response(size_t window, size_t event_number, const char* response)
    parameters: ["u32", "u32", "string"],
    result: "void",
  },
  webui_exit: {
    // void webui_exit(void)
    parameters: [],
    result: "void",
  },
  webui_is_shown: {
    // u32 webui_is_shown(size_t window)
    parameters: ["u32"],
    result: "u32",
  },
  webui_close: {
    // void webui_close(size_t window)
    parameters: ["u32"],
    result: "void",
  },
  webui_set_file_handler: {
    // void webui_set_file_handler(size_t window, const void* (*handler)(const char* filename, int* length))
    parameters: ["u32", "pointer"],
    pointers: [, 'file_callback'],
    result: "void",
  },
  webui_interface_is_app_running: {
    // u32 webui_interface_is_app_running(void)
    parameters: [],
    result: "u32",
  },
  webui_set_profile: {
    // void webui_set_profile(size_t window, const char* name, const char* path)
    parameters: ["u32", "string", "string"],
    result: "void",
  },
  webui_interface_get_int_at: {
    // long long int webui_interface_get_int_at(size_t window, size_t event_number, size_t index)
    parameters: ["u32", "u32", "u32"],
    result: "i64",
  },
  webui_interface_get_string_at: {
    // const char* webui_interface_get_string_at(size_t window, size_t event_number, size_t index)
    parameters: ["u32", "u32", "u32"],
    rpointer: 'const char*',
    result: "pointer",
  },
/*
  webui_interface_get_u32_at: {
    // u32 webui_interface_get_u32_at(size_t window, size_t event_number, size_t index)
    parameters: ["u32", "u32", "u32"],
    result: "u32",
  },
*/
  // webui_interface_get_size_at: {
  //   // size_t webui_interface_get_size_at(size_t window, size_t event_number, size_t index)
  //   parameters: ["u32", "u32", "u32"],
  //   result: "u32",
  // },
  webui_clean: {
    // void webui_clean()
    parameters: [],
    result: "void",
  },
  webui_set_root_folder: {
    // u32 webui_set_root_folder(size_t window, const char* path)
    parameters: ["u32", "string"],
    result: "u32",
  },
  webui_set_tls_certificate: {
    // u32 webui_set_tls_certificate(const char* certificate_pem, const char* private_key_pem)
    parameters: ["string", "string"],
    result: "u32",
  },
  webui_set_kiosk: {
    // void webui_set_kiosk(size_t window, u32 status)
    parameters: ["u32", "u32"],
    result: "void",
  },
  webui_destroy: {
    // void webui_destroy(size_t window)
    parameters: ["u32"],
    result: "void",
  },
  webui_set_timeout: {
    // void webui_set_timeout(size_t second)
    parameters: ["u32"],
    result: "void",
  },
  webui_set_icon: {
    // void webui_set_icon(size_t window, const char* icon, const char* icon_type)
    parameters: ["u32", "string", "string"],
    result: "void",
  },
  webui_encode: {
    // char* webui_encode(const char* str)
    parameters: ["string"],
    rpointer: 'char*',
    result: "pointer",
  },
  webui_decode: {
    // char* webui_decode(const char* str)
    parameters: ["string"],
    rpointer: 'char*',
    result: "pointer",
  },
  webui_free: {
    // void webui_free(void* ptr)
    parameters: ["pointer"],
    result: "void",
  },
  webui_malloc: {
    // void* webui_malloc(size_t size)
    parameters: ["u32"],
    result: "pointer",
  },
  webui_send_raw: {
    // void webui_send_raw(size_t window, const char* function, const void* raw, size_t size)
    parameters: ["u32", "string", "buffer", "u32"],
    result: "void",
  },
  webui_set_hide: {
    // void webui_set_hide(size_t window, u32 status)
    parameters: ["u32", "u32"],
    result: "void",
  },
  webui_set_size: {
    // void webui_set_size(size_t window, unsigned int width, unsigned int height)
    parameters: ["u32", "u32", "u32"],
    result: "void",
  },
  webui_set_position: {
    // void webui_set_position(size_t window, unsigned int x, unsigned int y)
    parameters: ["u32", "u32", "u32"],
    result: "void",
  },
  webui_get_url: {
    // const char* webui_get_url(size_t window)
    parameters: ["u32"],
    rpointer: 'const char*',
    result: "pointer",
  },
  webui_set_public: {
    // void webui_set_public(size_t window, u32 status)
    parameters: ["u32", "u32"],
    result: "void",
  },
  webui_navigate: {
    // void webui_navigate(size_t window, const char* url)
    parameters: ["u32", "string"],
    result: "void",
  },
  webui_delete_all_profiles: {
    // void webui_delete_all_profiles(void)
    parameters: [],
    result: "void",
  },
  webui_delete_profile: {
    // void webui_delete_profile(size_t window)
    parameters: ["u32"],
    result: "void",
  },
  webui_get_parent_process_id: {
    // size_t webui_get_parent_process_id(size_t window)
    parameters: ["u32"],
    result: "u32",
  },
  webui_get_child_process_id: {
    // size_t webui_get_child_process_id(size_t window)
    parameters: ["u32"],
    result: "u32",
  },
  webui_set_port: {
    // u32 webui_set_port(size_t window, size_t port)
    parameters: ["u32", "u32"],
    result: "u32",
  },
  webui_set_runtime: {
    // void webui_set_runtime(size_t window, size_t runtime)
    parameters: ["u32", "u32"],
    result: "void",
  }
}

const include_paths = ['./deps/webui/include']
//const includes = ['webui.h']
const includes = []
const name = 'webui'
const libs = []
//const obj = ['deps/webui/dist/libwebui-2-static.a']
const obj = ['deps/webui/dist/civetweb.o', 'deps/webui/dist/webui.o']
const preamble = `
#ifdef __cplusplus
extern "C"
    {
#endif
#include <webui.h>
#ifdef __cplusplus
    }
#endif

typedef void (*ui_callback)(size_t, size_t, char*, size_t, size_t);
typedef const void* (*file_callback)(const char* filename, int* length);
`

export { api, name, libs, obj, includes, include_paths, preamble }
