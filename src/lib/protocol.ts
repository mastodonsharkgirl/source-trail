import type { RankedPassage } from './ranking.js';
import type { Corpus } from './sources.js';

export type WorkerRequest =
  | { type: 'load'; jobId: string; revision: string }
  | { type: 'search'; jobId: string; revision: string; corpus: Corpus; query: string };
export type WorkerResponse =
  | { type: 'progress'; jobId: string; revision: string; percent: number }
  | { type: 'loading'; jobId: string; revision: string }
  | { type: 'ready'; jobId: string; revision: string }
  | { type: 'results'; jobId: string; revision: string; results: RankedPassage[]; tokenCount: number }
  | { type: 'error'; jobId: string; revision: string; message: string };

export function acceptsWorkerResponse(expected: Pick<WorkerRequest, 'jobId' | 'revision'>, response: WorkerResponse): boolean {
  return expected.jobId === response.jobId && expected.revision === response.revision;
}
