import { describe, expect, it } from 'vitest';
import { WorkerCoordinator } from '../src/lib/worker-controller.js';
import type { Corpus } from '../src/lib/sources.js';

const corpus: Corpus = { revision: 'rev-1', passages: [] };
const searchRequest = (jobId: string, revision = 'rev-1') => ({ type: 'search' as const, jobId, revision, corpus, query: 'camera' });

describe('WorkerCoordinator', () => {
  it('rejects a request whose corpus revision disagrees with its message revision', async () => {
    const messages: unknown[] = [];
    let searches = 0;
    const coordinator = new WorkerCoordinator({ post: (message) => messages.push(message), load: async () => undefined, search: async () => { searches += 1; return { type: 'results', jobId: 'x', revision: 'rev-1', results: [], tokenCount: 1 }; } });
    await coordinator.handle(searchRequest('job-1', 'rev-2'));
    expect(searches).toBe(0);
    expect(messages).toContainEqual(expect.objectContaining({ type: 'error', jobId: 'job-1', revision: 'rev-2' }));
  });

  it('shares one pending model load across concurrent requests', async () => {
    const messages: unknown[] = [];
    let loads = 0;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const coordinator = new WorkerCoordinator({ post: (message) => messages.push(message), load: async () => { loads += 1; await pending; }, search: async () => ({ type: 'results', jobId: 'x', revision: 'rev-1', results: [], tokenCount: 1 }) });
    const first = coordinator.handle({ type: 'load', jobId: 'load-1', revision: 'rev-1' });
    const second = coordinator.handle({ type: 'load', jobId: 'load-2', revision: 'rev-1' });
    release();
    await Promise.all([first, second]);
    expect(loads).toBe(1);
    expect(messages.filter((message) => (message as { type: string }).type === 'ready')).toHaveLength(2);
  });

  it('clears a failed load so a later concurrent retry shares one new attempt', async () => {
    const messages: unknown[] = [];
    let loads = 0;
    let release!: () => void;
    const pendingRetry = new Promise<void>((resolve) => { release = resolve; });
    const coordinator = new WorkerCoordinator({
      post: (message) => messages.push(message),
      load: async () => {
        loads += 1;
        if (loads === 1) throw new Error('network unavailable');
        await pendingRetry;
      },
      search: async () => ({ type: 'results', jobId: 'x', revision: 'rev-1', results: [], tokenCount: 1 }),
    });
    await coordinator.handle({ type: 'load', jobId: 'failed', revision: 'rev-1' });
    const retryOne = coordinator.handle({ type: 'load', jobId: 'retry-one', revision: 'rev-1' });
    const retryTwo = coordinator.handle({ type: 'load', jobId: 'retry-two', revision: 'rev-1' });
    await Promise.resolve();
    expect(loads).toBe(2);
    release();
    await Promise.all([retryOne, retryTwo]);
    expect(messages).toContainEqual(expect.objectContaining({ type: 'error', jobId: 'failed' }));
    expect(messages.filter((message) => (message as { type: string }).type === 'ready')).toHaveLength(2);
  });

  it('serializes overlapping searches in message order', async () => {
    const order: string[] = [];
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const coordinator = new WorkerCoordinator({ post: () => undefined, load: async () => undefined, search: async (request) => { order.push(`start:${request.jobId}`); if (request.jobId === 'one') await pending; order.push(`end:${request.jobId}`); return { type: 'results', jobId: request.jobId, revision: request.revision, results: [], tokenCount: 1 }; } });
    await coordinator.handle({ type: 'load', jobId: 'load', revision: 'rev-1' });
    const first = coordinator.handle(searchRequest('one'));
    const second = coordinator.handle(searchRequest('two'));
    await Promise.resolve();
    expect(order).toEqual(['start:one']);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['start:one', 'end:one', 'start:two', 'end:two']);
  });
});
