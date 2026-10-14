import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, pipeline } from '@huggingface/transformers';
import { MODEL_DTYPE, MODEL_ID, MODEL_REVISION, NORMALIZED_VECTORS, POOLING, VECTOR_DIMENSIONS } from '../src/lib/sources.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelPath = path.join(root, 'public', 'models', 'Xenova', 'all-MiniLM-L6-v2', MODEL_REVISION);

export async function createPolicyEncoder() {
  const manifest = JSON.parse(await readFile(path.join(root, 'public', 'models', 'manifest.json'), 'utf8'));
  if (manifest.model !== MODEL_ID || manifest.revision !== MODEL_REVISION) throw new Error('Pinned Policy Lab model metadata does not match the local manifest.');
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.useFSCache = false;
  env.localModelPath = modelPath;
  const started = performance.now();
  const extractor = await pipeline('feature-extraction', modelPath, { dtype: MODEL_DTYPE, device: 'cpu' });
  const loadMs = performance.now() - started;
  const metadata = Object.freeze({
    model: MODEL_ID,
    revision: MODEL_REVISION,
    runtime: '@huggingface/transformers 4.3.0 Node CPU',
    dtype: MODEL_DTYPE,
    pooling: POOLING,
    normalized: NORMALIZED_VECTORS,
    dimensions: VECTOR_DIMENSIONS,
    loadMs,
    assetIdentity: manifest.assets.map(({ path: assetPath, sha256 }) => ({ path: assetPath, sha256 })),
  });
  return {
    metadata,
    async embed(texts) {
      if (!Array.isArray(texts) || texts.length === 0 || texts.some((text) => typeof text !== 'string')) throw new Error('Policy encoder requires a non-empty text batch.');
      const startedEmbedding = performance.now();
      const tokenCounts = await Promise.all(texts.map(async (text) => (await extractor.tokenizer(text, { truncation: false, padding: false })).input_ids.dims.at(-1)));
      if (tokenCounts.some((count) => !Number.isInteger(count) || count > 512)) throw new Error('Policy text exceeds the 512-token MiniLM limit; context was not truncated.');
      const vectors = (await extractor(texts, { pooling: POOLING, normalize: NORMALIZED_VECTORS })).tolist();
      if (!vectors.every((vector) => Array.isArray(vector) && vector.length === VECTOR_DIMENSIONS && vector.every(Number.isFinite))) throw new Error('Policy encoder returned invalid MiniLM vectors.');
      return { vectors, tokenCounts, elapsedMs: performance.now() - startedEmbedding };
    },
    async dispose() { await extractor.dispose(); },
  };
}
