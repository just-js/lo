const preamble = `
class FileOutputStream : public v8::OutputStream {
 public:
  explicit FileOutputStream(FILE* stream) : stream_(stream) {}

  virtual int GetChunkSize() {
    return 65536;  // big chunks == faster
  }

  virtual void EndOfStream() {}

  virtual WriteResult WriteAsciiChunk(char* data, int size) {
    const size_t len = static_cast<size_t>(size);
    size_t off = 0;

    while (off < len && !feof(stream_) && !ferror(stream_))
      off += fwrite(data + off, 1, len - off, stream_);

    return off == len ? kContinue : kAbort;
  }

 private:
  FILE* stream_;
};

void snapshotSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  String::Utf8Value path(isolate, args[0]);
  FILE* fp = fopen(*path, "w");
  if (fp == NULL) {
    args.GetReturnValue().Set(Integer::New(isolate, errno));
    return;
  }
  const v8::HeapSnapshot *snap = isolate->GetHeapProfiler()->TakeHeapSnapshot();
  FileOutputStream stream(fp);
  snap->Serialize(&stream, v8::HeapSnapshot::kJSON);
  int err = 0;
  if (fclose(fp)) err = errno;
  const_cast<v8::HeapSnapshot*>(snap)->Delete();
  args.GetReturnValue().Set(Integer::New(isolate, err));
}

`

const api = {
  snapshot: {
    declare_only: true,
    nofast: true
  }
}

const includes = ['v8-profiler.h']
const name = 'heap'

export { name, api, preamble, includes }
