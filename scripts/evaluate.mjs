import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, pipeline } from '@huggingface/transformers';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(await readFile(path.join(root, 'docs/superpowers/specs/source-trail-fixture.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'public/models/manifest.json'), 'utf8'));
const paragraphs = fixture.sources.flatMap((source) => source.text.split(/\r?\n\s*\r?\n/).map((text, index) => ({ id: `${source.id}:${index + 1}`, text: text.trim() })).filter((passage) => passage.text));
env.allowRemoteModels = false;
env.allowLocalModels = true;
const modelPath = path.join(root, 'public/models/Xenova/all-MiniLM-L6-v2', manifest.revision);
env.localModelPath = modelPath;
env.useFSCache = false;
const started = performance.now();
const extractor = await pipeline('feature-extraction', modelPath, { dtype: 'q8', device: 'cpu' });
const loadMs = Math.round(performance.now() - started);
const tokenCount = async (text) => (await extractor.tokenizer(text, { truncation: false, padding: false })).input_ids.dims.at(-1);
const passageTokenCounts = await Promise.all(paragraphs.map((passage) => tokenCount(passage.text)));
if (passageTokenCounts.some((count) => count > 512)) throw new Error('Fixture passage exceeds 512 actual tokenizer tokens.');
const passageVectors = (await extractor(paragraphs.map((passage) => passage.text), { pooling: 'mean', normalize: true })).tolist();
const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);
const lexical = (query) => {
  const q = new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  return paragraphs.map((passage) => {
    const words = passage.text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    return { id: passage.id, score: words.filter((word) => q.has(word)).length / Math.sqrt(Math.max(1, q.size * words.length)) };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
};
const semantic = async (query) => {
  const tokens = await tokenCount(query);
  if (tokens > 512) throw new Error(`Query exceeds actual tokenizer limit: ${tokens}.`);
  const vector = (await extractor(query, { pooling: 'mean', normalize: true })).tolist()[0];
  return { tokens, ranked: paragraphs.map((passage, index) => ({ id: passage.id, score: dot(passageVectors[index], vector) })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)) };
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
  const recall = positives.reduce((sum, row) => sum + top(row).slice(0, 3).filter((item) => row.relevant.includes(item.id)).length / row.relevant.length, 0) / positives.length;
  const mrr = positives.reduce((sum, row) => { const position = top(row).findIndex((item) => row.relevant.includes(item.id)); return sum + (position < 0 ? 0 : 1 / (position + 1)); }, 0) / positives.length;
  const noAnswer = rows.filter((row) => !row.relevant.length);
  return { recallAt3: recall, mrrFirstRelevantFullRanking: mrr, noAnswerFalsePositives: noAnswer.filter(answered).length, noAnswerAbstentions: noAnswer.filter((row) => !answered(row)).length };
};
const result = {
  fixtureVersion: fixture.version, fixtureSha256: '07db8d2593158d250131b79f993b5b12f56df2297875f57c4a6c7ee08e5417cf',
  method: { model: manifest.model, revision: manifest.revision, runtime: '@huggingface/transformers 4.3.0 Node CPU', dtype: 'q8', pooling: 'mean', normalized: true, dimensions: 384, tokenizerLimit: 512 },
  measurement: { loadMs, passageTokenCounts, threshold, thresholdSelection: 'max calibration answer-vs-no-answer accuracy; held-out labels excluded' },
  calibration: { semantic: summarize(calibrationRows, 'semantic'), lexical: summarize(calibrationRows, 'lexical'), rows: calibrationRows },
  heldOut: { semantic: summarize(heldOutRows, 'semantic'), lexical: summarize(heldOutRows, 'lexical'), rows: heldOutRows },
  caveat: 'Node CPU measurement verifies actual tokenizer and inference. Browser ONNX WASM release measurement belongs to Task 2 and may differ.'
};
await mkdir(path.join(root, 'src/data'), { recursive: true });
await writeFile(path.join(root, 'src/data/evaluation.json'), JSON.stringify(result, null, 2));
await extractor.dispose();
process.stdout.write(`Evaluation written: threshold ${threshold.toFixed(6)}, held-out semantic Recall@3 ${result.heldOut.semantic.recallAt3.toFixed(3)}.\n`);
