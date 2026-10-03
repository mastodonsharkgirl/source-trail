import { env, pipeline } from '@huggingface/transformers';
import { rankVectors } from '../lib/ranking.js';
import type { WorkerRequest, WorkerResponse } from '../lib/protocol.js';
import { MAX_QUERY_CHARACTERS, MODEL_DTYPE, MODEL_LOCAL_PATH, POOLING, VECTOR_DIMENSIONS } from '../lib/sources.js';
import { WorkerCoordinator } from '../lib/worker-controller.js';

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

async function load(): Promise<void> {
  // The optional progress callback in 4.3.0 probes a relative local model with
  // a full GET before loading it. Omit it to transfer the pinned weights once.
  // The UI shows an indeterminate, truthful download/preparation state instead.
  extractor ??= await pipeline('feature-extraction', MODEL_LOCAL_PATH, { dtype: MODEL_DTYPE, device: 'wasm' });
}

async function search(request: Extract<WorkerRequest, { type: 'search' }>): Promise<Extract<WorkerResponse, { type: 'results' }>> {
  if (request.query.length > MAX_QUERY_CHARACTERS) throw new Error(`Question exceeds the ${MAX_QUERY_CHARACTERS}-character limit.`);
  if (!extractor) throw new Error('Load local search before searching.');
  const queryTokens = await tokenCount(request.query);
  if (queryTokens > MAX_MODEL_TOKENS) throw new Error(`Question has ${queryTokens} model tokens; the local model accepts at most ${MAX_MODEL_TOKENS}.`);
  for (const passage of request.corpus.passages) {
    const count = await tokenCount(passage.text);
    if (count > MAX_MODEL_TOKENS) throw new Error(`Passage ${passage.id} has ${count} model tokens; shorten the source note before searching.`);
  }
  const passageOutput = await extractor(request.corpus.passages.map((passage) => passage.text), { pooling: POOLING, normalize: true });
  const vectors = passageOutput.tolist() as number[][];
  const queryOutput = await extractor(request.query, { pooling: POOLING, normalize: true });
  const queryVector = (queryOutput.tolist() as number[][])[0];
  if (!queryVector || queryVector.length !== VECTOR_DIMENSIONS) throw new Error('Local model returned an unexpected vector dimension.');
  return { type: 'results', jobId: request.jobId, revision: request.revision, results: rankVectors(request.corpus.passages, vectors, queryVector), tokenCount: queryTokens };
}

const coordinator = new WorkerCoordinator({ post, load, search });

self.addEventListener('message', ({ data }: MessageEvent<WorkerRequest>) => {
  void coordinator.handle(data);
});

export { MAX_MODEL_TOKENS };
