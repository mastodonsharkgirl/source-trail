export const MAX_NOTES = 12;
export const MAX_PASSAGES = 24;
export const MAX_CORPUS_BYTES = 16 * 1024;
export const MAX_QUERY_CHARACTERS = 800;
export const MODEL_REVISION = '751bff37182d3f1213fa05d7196b954e230abad9';
export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
export const MODEL_DTYPE = 'q8';
export const MODEL_LOCAL_PATH = `/models/Xenova/all-MiniLM-L6-v2/${MODEL_REVISION}/`;
export const VECTOR_DIMENSIONS = 384;
export const POOLING = 'mean';
export const NORMALIZED_VECTORS = true;

export interface SourceNote {
  id: string;
  title: string;
  version: string;
  text: string;
}

export interface Passage {
  id: string;
  sourceId: string;
  title: string;
  version: string;
  text: string;
}

export interface Corpus {
  revision: string;
  passages: readonly Passage[];
}

const identifier = /^[a-z0-9][a-z0-9-]{0,63}$/;
const encoder = new TextEncoder();

function corpusRevision(notes: readonly SourceNote[]): string {
  let hash = 2166136261;
  for (const character of JSON.stringify(notes)) {
    hash ^= character.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return `sources-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validateText(value: string, field: string, noteNumber: number): void {
  if (!value.trim()) throw new Error(`Note ${noteNumber} ${field} must not be empty.`);
  if (value.includes('\u0000')) throw new Error(`Note ${noteNumber} ${field} must not contain NUL characters.`);
}

export function validateSources(notes: readonly SourceNote[]): Corpus {
  if (!Array.isArray(notes)) throw new Error('Sources must be an array of notes.');
  if (notes.length === 0) throw new Error('Add at least one source note.');
  if (notes.length > MAX_NOTES) throw new Error(`Use at most ${MAX_NOTES} source notes.`);
  let byteCount = 0;
  const identifiers = new Set<string>();
  const passages: Passage[] = [];
  notes.forEach((note, noteIndex) => {
    const number = noteIndex + 1;
    if (!note || typeof note !== 'object') throw new Error(`Note ${number} must be an object.`);
    if (typeof note.id !== 'string' || !identifier.test(note.id)) throw new Error(`Note ${number} id must use lowercase letters, digits, and hyphens.`);
    if (identifiers.has(note.id)) throw new Error(`Note ${number} repeats the id “${note.id}”.`);
    identifiers.add(note.id);
    if (typeof note.title !== 'string') throw new Error(`Note ${number} title must be text.`);
    if (typeof note.version !== 'string') throw new Error(`Note ${number} version must be text.`);
    if (typeof note.text !== 'string') throw new Error(`Note ${number} text must be text.`);
    validateText(note.title, 'title', number);
    validateText(note.version, 'version', number);
    validateText(note.text, 'text', number);
    byteCount += encoder.encode(note.text).byteLength;
    const blocks: string[] = note.text.split(/\r?\n\s*\r?\n/).map((block: string) => block.trim()).filter(Boolean);
    blocks.forEach((text: string, passageIndex: number) => passages.push(Object.freeze({
      id: `${note.id}:${passageIndex + 1}`, sourceId: note.id, title: note.title.trim(), version: note.version.trim(), text,
    })));
  });
  if (byteCount > MAX_CORPUS_BYTES) throw new Error(`Source text exceeds the 16 KB UTF-8 limit (${byteCount} bytes).`);
  if (passages.length > MAX_PASSAGES) throw new Error(`Sources create ${passages.length} passages; use at most ${MAX_PASSAGES}.`);
  if (passages.length === 0) throw new Error('Sources need at least one non-empty passage.');
  return Object.freeze({ revision: corpusRevision(notes), passages: Object.freeze(passages) });
}
