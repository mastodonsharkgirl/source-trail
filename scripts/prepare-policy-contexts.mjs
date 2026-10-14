import { preparePolicyCorpus } from '../src/policy/documents.ts';
import { assertPolicyQueryInput } from '../src/policy/eligibility.ts';
import { selectPolicyContext } from '../src/policy/retrieval.ts';
import { createPolicyEncoder } from './policy-encoder.mjs';

const keys = (value) => Object.keys(value).sort();
const exactKeys = (value, expected, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const extras = keys(value).filter((key) => !expected.includes(key));
  const missing = expected.filter((key) => !(key in value));
  if (extras.length) throw new Error(`${label} has unexpected key ${extras[0]}.`);
  if (missing.length) throw new Error(`${label} is missing key ${missing[0]}.`);
};
const documentKeys = ['id', 'title', 'version', 'text', 'tenant', 'allowedRoles', 'policyKey', 'authority', 'status', 'effectiveOn', 'expiresOn', 'supersedes'];
const inputKeys = ['query', 'principal', 'asOf'];
const principalKeys = ['tenant', 'role'];

async function readStdin() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 2 * 1024 * 1024) throw new Error('Policy context stdin exceeds 2 MiB.');
    chunks.push(chunk);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}

function parseRequest(raw) {
  let request;
  try { request = JSON.parse(raw); } catch { throw new Error('Policy context input must be valid JSON.'); }
  exactKeys(request, ['schemaVersion', 'fixtureHash', 'documents', 'cases', 'threshold'], 'Policy context input');
  if (request.schemaVersion !== 1 || typeof request.fixtureHash !== 'string' || !/^[a-f0-9]{64}$/i.test(request.fixtureHash) || !Array.isArray(request.documents) || !Array.isArray(request.cases) || !Number.isFinite(request.threshold)) throw new Error('Policy context input has invalid field values.');
  if (!request.cases.length || request.cases.length > 36) throw new Error('Policy context input requires 1 to 36 cases.');
  const caseIds = new Set();
  request.documents.forEach((document, index) => exactKeys(document, documentKeys, `Document ${index + 1}`));
  request.cases.forEach((policyCase, index) => {
    exactKeys(policyCase, ['caseId', 'input'], `Case ${index + 1}`);
    if (typeof policyCase.caseId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(policyCase.caseId) || caseIds.has(policyCase.caseId)) throw new Error(`Case ${index + 1} needs a unique valid caseId.`);
    caseIds.add(policyCase.caseId);
    exactKeys(policyCase.input, inputKeys, `Case ${index + 1} input`);
    exactKeys(policyCase.input.principal, principalKeys, `Case ${index + 1} principal`);
    assertPolicyQueryInput(policyCase.input);
  });
  return request;
}

try {
  const request = parseRequest(await readStdin());
  const corpus = preparePolicyCorpus(request.documents);
  const encoder = await createPolicyEncoder();
  try {
    const cases = [];
    const embeddingCache = new Map();
    for (const policyCase of request.cases) {
      const selections = [];
      for (const method of ['lexical', 'semantic', 'full-context']) selections.push(await selectPolicyContext(corpus, policyCase.input, method, { threshold: request.threshold, embedder: encoder, embeddingCache }));
      cases.push({ caseId: policyCase.caseId, input: policyCase.input, selections });
    }
    const output = `${JSON.stringify({ schemaVersion: 1, fixtureHash: request.fixtureHash, cases, encoder: encoder.metadata })}\n`;
    if (Buffer.byteLength(output, 'utf8') > 2 * 1024 * 1024) throw new Error('Policy context stdout exceeds 2 MiB.');
    process.stdout.write(output);
  } finally {
    await encoder.dispose();
  }
} catch (error) {
  process.stderr.write(`Policy context preparation rejected: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exitCode = 1;
}
