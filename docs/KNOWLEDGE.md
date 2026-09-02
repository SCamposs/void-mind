# Knowledge

Knowledge is explicit user-supplied context, not hidden memory. The first implemented layer supports UTF-8 Markdown and plain-text files up to 512 KB.

On import, VOID Mind validates the type and size, reads the content, writes an app-managed copy under the application data directory, and leaves the original file unchanged. The full imported content remains visible in the Knowledge surface.

Sources belong to one workspace. A conversation in that workspace exposes a Context panel where each source can be selected or removed. Only selected sources are included with workspace instructions during generation. With a remote provider, that visible selection is the data-transfer boundary.

There is no indexing, embeddings pipeline, RAG, background scan, or automatic filesystem watching in this layer.
