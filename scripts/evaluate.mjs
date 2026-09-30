import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, pipeline } from '@huggingface/transformers';
import { lexicalSearch, rankVectors } from '../src/lib/ranking.ts';
import { MODEL_DTYPE, MODEL_ID, MODEL_REVISION, NORMALIZED_VECTORS, POOLING, VECTOR_DIMENSIONS, validateSources } from '../src/lib/sources.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(root, 'docs/superpowers/specs/source-trail-fixture.json');
const fixtureBytes = await readFile(fixturePath);
const fixtureSha256 = createHash('sha256').update(fixtureBytes).digest('hex');
const expectedFixtureSha256 = '07db8d2593158d250131b79f993b5b12f56df2297875f57c4a6c7ee08e5417cf';
if (fixtureSha256 !== expectedFixtureSha256) throw new Error(`Frozen fixture SHA-256 mismatch: expected ${expectedFixtureSha256}, received ${fixtureSha256}.`);
const fixture = JSON.parse(fixtureBytes.toString('utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'public/models/manifest.json'), 'utf8'));
if (manifest.model !== MODEL_ID || manifest.revision !== MODEL_REVISION) throw new Error('Model manifest disagrees with production model metadata.');
const corpus = validateSources(fixture.sources);
env.allowRemoteModels = false;
env.allowLocalModels = true;
const modelPath = path.join(root, 'public/models/Xenova/all-MiniLM-L6-v2', manifest.revision);
env.localModelPath = modelPath;
env.useFSCache = false;
const started = performance.now();
const extractor = await pipeline('feature-extraction', modelPath, { dtype: 'q8', device: 'cpu' });
const loadMs = Math.round(performance.now() - started);
const tokenCount = async (text) => (await extractor.tokenizer(text, { truncation: false, padding: false })).input_ids.dims.at(-1);
const passageTokenCounts = await Promise.all(corpus.passages.map((passage) => tokenCount(passage.text)));
if (passageTokenCounts.some((count) => count > 512)) throw new Error('Fixture passage exceeds 512 actual tokenizer tokens.');
const passageVectors = (await extractor(corpus.passages.map((passage) => passage.text), { pooling: POOLING, normalize: NORMALIZED_VECTORS })).tolist();
const lexical = (query) => lexicalSearch(corpus, query).map(({ id, score }) => ({ id, score }));
const semantic = async (query) => {
  const tokens = await tokenCount(query);
  if (tokens > 512) throw new Error(`Query exceeds actual tokenizer limit: ${tokens}.`);
  const vector = (await extractor(query, { pooling: POOLING, normalize: NORMALIZED_VECTORS })).tolist()[0];
  return { tokens, ranked: rankVectors(corpus.passages, passageVectors, vector).map(({ id, score }) => ({ id, score })) };
};
const calibrationRows = [];
for (const row of fixture.calibration) calibrationRows.push({ ...row, semantic: await semantic(row.query), lexical: lexical(row.query) });
const candidates = [...new Set(calibrationRows.map((row) => row.semantic.ranked[0].score))].sort((a, b) => a - b);
const scoreThreshold = (threshold) => calibrationRows.reduce((score, row) => {
  const predictsAnswer = row.semantic.ranked[0].score >= threshold;
  const shouldAnswer = row.relevant.length > 0;
  return score + (predictsAnswer === shouldAnswer ? 1 : 0);
}, 0);
const threshold = candidates.sort((a, b) => scoreThreshold(b) - scoreThreshold(a) || b - a)[0];
const evaluateRows = async (rows) => Promise.all(rows.map(async (row) => ({ ...row, semantic: await semantic(row.query), lexical: lexical(row.query) })));
const heldOutRows = await evaluateRows(fixture.heldOut);
const summarize = (rows, method) => {
  const top = (row) => method === 'semantic' ? row.semantic.ranked : row.lexical;
  const answered = (row) => method === 'semantic' ? top(row)[0].score >= threshold : top(row)[0].score > 0;
  const positives = rows.filter((row) => row.relevant.length);
  const ungatedRecallAt3 = positives.reduce((sum, row) => sum + top(row).slice(0, 3).filter((item) => row.relevant.includes(item.id)).length / row.relevant.length, 0) / positives.length;
  const ungatedMrrFirstRelevantFullRanking = positives.reduce((sum, row) => { const position = top(row).findIndex((item) => row.relevant.includes(item.id)); return sum + (position < 0 ? 0 : 1 / (position + 1)); }, 0) / positives.length;
  const noAnswer = rows.filter((row) => !row.relevant.length);
  return { ungatedRecallAt3, ungatedMrrFirstRelevantFullRanking, answerableAccepted: positives.filter(answered).length, answerableAbstained: positives.filter((row) => !answered(row)).length, noAnswerFalsePositives: noAnswer.filter(answered).length, noAnswerAbstentions: noAnswer.filter((row) => !answered(row)).length };
};
const result = {
  fixtureVersion: fixture.version, fixtureSha256,
  method: { model: MODEL_ID, revision: MODEL_REVISION, runtime: '@huggingface/transformers 4.3.0 Node CPU', dtype: MODEL_DTYPE, pooling: POOLING, normalized: NORMALIZED_VECTORS, dimensions: VECTOR_DIMENSIONS, tokenizerLimit: 512, embeddingBatchStrategy: 'all passages in one batch, then each query in a separate batch' },
  measurement: { loadMs, passageTokenCounts, threshold, thresholdSelection: 'max calibration answer-vs-no-answer accuracy; held-out labels excluded' },
  calibration: { semantic: summarize(calibrationRows, 'semantic'), lexical: summarize(calibrationRows, 'lexical'), rows: calibrationRows },
  heldOut: { semantic: summarize(heldOutRows, 'semantic'), lexical: summarize(heldOutRows, 'lexical'), rows: heldOutRows },
  caveat: 'Node CPU measurement verifies actual tokenizer and inference. Browser ONNX WASM release measurement belongs to Task 2 and may differ.'
};
await mkdir(path.join(root, 'src/data'), { recursive: true });
const outputPath = path.join(root, 'src/data/evaluation.json');
const withoutTiming = (value) => { const copy = structuredClone(value); delete copy.measurement.loadMs; return copy; };
if (process.argv.includes('--check')) {
  const existing = JSON.parse(await readFile(outputPath, 'utf8'));
  if (JSON.stringify(withoutTiming(existing)) !== JSON.stringify(withoutTiming(result))) throw new Error('Generated evaluation artifact drifted from the frozen fixture and production kernel. Run npm run evaluate and commit the result.');
} else {
  await writeFile(outputPath, JSON.stringify(result, null, 2));
}
await extractor.dispose();
process.stdout.write(`Evaluation ${process.argv.includes('--check') ? 'verified' : 'written'}: threshold ${threshold.toFixed(6)}, held-out semantic ungated Recall@3 ${result.heldOut.semantic.ungatedRecallAt3.toFixed(3)}.\n`);
