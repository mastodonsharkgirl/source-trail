import { env, pipeline } from '@huggingface/transformers';
import { rankVectors } from '../lib/ranking.js';
import type { WorkerRequest, WorkerResponse } from '../lib/protocol.js';
import { MAX_QUERY_CHARACTERS, MODEL_DTYPE, MODEL_LOCAL_PATH, POOLING, VECTOR_DIMENSIONS } from '../lib/sources.js';

const MAX_MODEL_TOKENS = 512;
type Extractor = Awaited<ReturnType<typeof pipeline<'feature-extraction'>>>;
let extractor: Extractor | undefined;

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = MODEL_LOCAL_PATH;
env.useBrowserCache = false;
env.useWasmCache = false;
const wasm = env.backends.onnx.wasm;
if (!wasm) throw new Error('ONNX WASM is unavailable in this worker.');
wasm.numThreads = 1;
wasm.wasmPaths = { mjs: '/models/onnxruntime/ort-wasm-simd-threaded.mjs', wasm: '/models/onnxruntime/ort-wasm-simd-threaded.wasm' };

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

async function tokenCount(text: string): Promise<number> {
  const encoded = extractor!.tokenizer(text, { truncation: false, padding: false });
  return encoded.input_ids.dims.at(-1) ?? 0;
}

async function load(request: Extract<WorkerRequest, { type: 'load' }>): Promise<void> {
  post({ type: 'loading', jobId: request.jobId, revision: request.revision });
  extractor ??= await pipeline('feature-extraction', MODEL_LOCAL_PATH, { dtype: MODEL_DTYPE, device: 'wasm' });
  post({ type: 'ready', jobId: request.jobId, revision: request.revision });
}

async function search(request: Extract<WorkerRequest, { type: 'search' }>): Promise<void> {
  if (request.query.length > MAX_QUERY_CHARACTERS) throw new Error(`Question exceeds the ${MAX_QUERY_CHARACTERS}-character limit.`);
  if (!extractor) throw new Error('Load local search before searching.');
  const queryTokens = await tokenCount(request.query);
  if (queryTokens > MAX_MODEL_TOKENS) throw new Error(`Question has ${queryTokens} model tokens; the local model accepts at most ${MAX_MODEL_TOKENS}.`);
  for (const passage of request.corpus.passages) {
    const count = await tokenCount(passage.text);
    if (count > MAX_MODEL_TOKENS) throw new Error(`Passage ${passage.id} has ${count} model tokens; shorten the source note before searching.`);
  }
  const output = await extractor([...request.corpus.passages.map((passage) => passage.text), request.query], { pooling: POOLING, normalize: true });
  const vectors = output.tolist() as number[][];
  const queryVector = vectors.pop();
  if (!queryVector || queryVector.length !== VECTOR_DIMENSIONS) throw new Error('Local model returned an unexpected vector dimension.');
  post({ type: 'results', jobId: request.jobId, revision: request.revision, results: rankVectors(request.corpus.passages, vectors, queryVector), tokenCount: queryTokens });
}

self.addEventListener('message', async ({ data }: MessageEvent<WorkerRequest>) => {
  try {
    if (data.type === 'load') await load(data);
    else await search(data);
  } catch (error) {
    post({ type: 'error', jobId: data.jobId, revision: data.revision, message: error instanceof Error ? error.message : 'Local search failed.' });
  }
});

export { MAX_MODEL_TOKENS };
