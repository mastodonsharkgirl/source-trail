import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'fd3e4371fc0f7fa99dc1b6118a66134a20e177ba';
const protectedFiles = [
  'docs/superpowers/specs/source-trail-fixture.json',
  'src/data/evaluation.json',
  'src/lib/sources.ts',
  'src/lib/ranking.ts',
  'src/lib/protocol.ts',
  'src/lib/worker-controller.ts',
  'src/workers/search.worker.ts',
  'docs/story-lab/fixture.json',
  'docs/story-lab/evaluation.json',
  'docs/story-lab/generation-evaluation.json',
  'src/story/atlas.json',
  'MODEL_MANIFEST.json',
  'public/models/manifest.json',
];
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const changed = protectedFiles.filter(path => {
  const original = git(['rev-parse', `${base}:${path}`]);
  // Apply the repository's normal Git clean/line-ending rules without writing objects.
  const current = git(['hash-object', `--path=${path}`, '--', path]);
  return original !== current;
});
if (changed.length) {
  process.stderr.write(`Policy Lab preservation failed against ${base}:\n${changed.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Preserved all ${protectedFiles.length} protected Git blobs against ${base}.\nNavigation and new policy files require separate diff/browser review.\n`);
}
