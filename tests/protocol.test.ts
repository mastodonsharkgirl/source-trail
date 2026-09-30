import { describe, expect, it } from 'vitest';
import { acceptsWorkerResponse } from '../src/lib/protocol.js';

describe('worker protocol', () => {
  it('ignores a response for an older corpus revision', () => {
    expect(acceptsWorkerResponse({ jobId: 'job-2', revision: 'rev-2' }, { jobId: 'job-2', revision: 'rev-1', type: 'results', results: [], tokenCount: 3 })).toBe(false);
  });
});
