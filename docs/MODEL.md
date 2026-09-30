# Local model assets

The browser worker uses `Xenova/all-MiniLM-L6-v2` at immutable revision
`751bff37182d3f1213fa05d7196b954e230abad9`, q8 weights, mean pooling, and
normalized 384-dimensional vectors. It runs ONNX WASM in one worker thread.

`npm run prepare-model` copies only the fixed manifest files into the ignored
same-host `public/models/` layout. It verifies the fixed byte lengths and SHA-256
hashes before and after copying; it never accepts a changed replacement asset.
The largest file is 22,972,370 bytes, below Cloudflare Pages' 25 MiB limit.

Tokenizer configuration declares a 512-token model limit. The worker measures
the actual tokenized query and every passage with truncation disabled, rejects
an excess explicitly, and never silently clips text.

Asset provenance: Transformers.js 4.3.0 and Xenova model assets are Apache-2.0
(`https://github.com/huggingface/transformers.js`,
`https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/751bff37182d3f1213fa05d7196b954e230abad9`).
ONNX Runtime Web is MIT (`https://github.com/microsoft/onnxruntime/blob/main/LICENSE`).
The original licence texts and notices are stored beside the manifest.
