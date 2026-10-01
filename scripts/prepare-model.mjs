import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'public/models/manifest.json'), 'utf8'));
const revisionPath = `Xenova/all-MiniLM-L6-v2/${manifest.revision}`;
const sourceFor = (asset) => asset.path.startsWith('onnxruntime/')
  ? path.join(root, 'node_modules/onnxruntime-web/dist', path.basename(asset.path))
  : null;
const targetFor = (asset) => path.join(root, 'public/models', asset.path);

async function verify(filename, asset) {
  const details = await stat(filename);
  const hash = createHash('sha256').update(await readFile(filename)).digest('hex');
  if (details.size !== asset.bytes || hash !== asset.sha256) throw new Error(`Asset verification failed for ${asset.path}. Expected locked size and SHA-256; delete the changed file and restore the pinned source.`);
  if (details.size >= 25 * 1024 * 1024) throw new Error(`Asset ${asset.path} exceeds the 25 MiB Pages file limit.`);
}

for (const asset of manifest.assets) {
  const source = sourceFor(asset);
  const target = targetFor(asset);
  await mkdir(path.dirname(target), { recursive: true });
  try { await verify(target, asset); continue; } catch { /* restore below */ }
  try {
    if (!source) throw new Error('Fetch the pinned upstream asset.');
    await verify(source, asset);
    await cp(source, target);
  } catch (error) {
    if (asset.path.startsWith('onnxruntime/')) throw error;
    const relativePath = asset.path.slice(`${revisionPath}/`.length);
    const response = await fetch(`https://huggingface.co/${manifest.model}/resolve/${manifest.revision}/${relativePath}`);
    if (!response.ok) throw new Error(`Pinned model download failed for ${asset.path}: HTTP ${response.status}.`);
    await writeFile(target, new Uint8Array(await response.arrayBuffer()));
  }
  await verify(target, asset);
}
await writeFile(path.join(root, 'public/models/.prepared.json'), JSON.stringify({ revision: manifest.revision, verifiedAt: new Date().toISOString() }, null, 2));
process.stdout.write(`Verified ${manifest.assets.length} pinned same-host assets.\n`);
