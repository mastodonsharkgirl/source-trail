import { createHash } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const fixturePath = resolve(root, 'docs/policy-lab/fixture.json');
const rubricPath = resolve(root, 'docs/policy-lab/rubric.json');
const manifestPath = resolve(root, 'docs/policy-lab/manifest.json');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fixtureBytes = await readFile(fixturePath);
const rubricBytes = await readFile(rubricPath);
const fixture = JSON.parse(fixtureBytes.toString('utf8'));
const manifest = {
  schemaVersion: 1,
  fixtureSha256: hash(fixtureBytes),
  rubricSha256: hash(rubricBytes),
  counts: { documents: fixture.documents.length, development: fixture.development.length, heldOut: fixture.heldOut.length },
};
const expected = `${JSON.stringify(manifest, null, 2)}\n`;
const write = process.argv.slice(2).join(' ') === '--write';
if (write) {
  try {
    await access(manifestPath, constants.F_OK);
    const existing = await readFile(manifestPath, 'utf8');
    if (existing !== expected) throw new Error('Refusing to overwrite an existing differing policy fixture manifest; create a new fixture version/path.');
  } catch (error) {
    if (error?.code === 'ENOENT') await writeFile(manifestPath, expected, 'utf8');
    else throw error;
  }
} else {
  const existing = await readFile(manifestPath, 'utf8');
  if (existing !== expected) throw new Error('Policy fixture manifest does not match the frozen fixture and rubric bytes.');
}
console.log(`Policy fixture manifest ${write ? 'written or confirmed' : 'confirmed'}: ${manifest.fixtureSha256}`);
