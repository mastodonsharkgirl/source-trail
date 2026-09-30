import { describe, expect, it } from 'vitest';
import { acceptsWorkerResponse } from '../src/lib/protocol.js';

describe('worker protocol', () => {
  it('ignores a response for an older corpus revision', () => {
    expect(acceptsWorkerResponse({ jobId: 'job-2', revision: 'rev-2' }, { jobId: 'job-2', revision: 'rev-1', type: 'results', results: [], tokenCount: 3 })).toBe(false);
  });

  it('ignores a response for a different job in the same revision', () => {
    expect(acceptsWorkerResponse({ jobId: 'job-2', revision: 'rev-2' }, { jobId: 'job-1', revision: 'rev-2', type: 'results', results: [], tokenCount: 3 })).toBe(false);
  });
});
