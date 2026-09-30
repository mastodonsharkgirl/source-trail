import type { WorkerRequest, WorkerResponse } from './protocol.js';

interface WorkerOperations {
  post(message: WorkerResponse): void;
  load(): Promise<void>;
  search(request: Extract<WorkerRequest, { type: 'search' }>): Promise<Extract<WorkerResponse, { type: 'results' }>>;
}

export class WorkerCoordinator {
  private loadPromise: Promise<void> | undefined;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly operations: WorkerOperations) {}

  private ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      const attempt = this.operations.load();
      this.loadPromise = attempt;
      void attempt.catch(() => {
        if (this.loadPromise === attempt) this.loadPromise = undefined;
      });
    }
    return this.loadPromise;
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const current = this.queue.then(operation, operation);
    this.queue = current.catch(() => undefined);
    return current;
  }

  handle(request: WorkerRequest): Promise<void> {
    if (request.type === 'load') {
      this.operations.post({ type: 'loading', jobId: request.jobId, revision: request.revision });
      return this.enqueue(async () => {
        try {
          await this.ensureLoaded();
          this.operations.post({ type: 'ready', jobId: request.jobId, revision: request.revision });
        } catch (error) {
          this.operations.post({ type: 'error', jobId: request.jobId, revision: request.revision, message: error instanceof Error ? error.message : 'Local search failed.' });
        }
      });
    }
    if (request.corpus.revision !== request.revision) {
      this.operations.post({ type: 'error', jobId: request.jobId, revision: request.revision, message: 'Search request corpus revision does not match its message revision.' });
      return Promise.resolve();
    }
    return this.enqueue(async () => {
      try {
        this.operations.post(await this.operations.search(request));
      } catch (error) {
        this.operations.post({ type: 'error', jobId: request.jobId, revision: request.revision, message: error instanceof Error ? error.message : 'Local search failed.' });
      }
    });
  }
}
