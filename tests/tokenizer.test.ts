import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, pipeline } from '@huggingface/transformers';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelPath = path.join(root, 'public/models/Xenova/all-MiniLM-L6-v2/751bff37182d3f1213fa05d7196b954e230abad9');

describe('pinned tokenizer', () => {
  it('counts actual tokens without truncation before local inference', async () => {
    await readFile(path.join(modelPath, 'tokenizer.json'));
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    const extractor = await pipeline('feature-extraction', modelPath, { dtype: 'q8', device: 'cpu' });
    const short = extractor.tokenizer('A damaged camera needs an inspection.', { truncation: false, padding: false }).input_ids.dims.at(-1);
    const long = extractor.tokenizer(Array.from({ length: 600 }, () => 'evidence').join(' '), { truncation: false, padding: false }).input_ids.dims.at(-1);
    expect(short).toBeLessThanOrEqual(512);
    expect(long).toBeGreaterThan(512);
    await extractor.dispose();
  });
});
