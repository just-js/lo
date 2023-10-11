typedef int (*increment_callback)(int i);

increment_callback inc_cb;

void register_callback (increment_callback cb) {
  inc_cb = cb;
}

void call_callback (unsigned int runs) {
  unsigned int counter = 0;
  for (unsigned int i = 0; i < runs; i++) {
    counter = inc_cb(counter);
  }
}
