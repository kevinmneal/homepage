export const stateKey = (fixedIds) => [...fixedIds].sort().join("|");

// One live worker owns the search graph. Only the newest requested arrangement
// is queued behind its current calculation; superseded answers never become
// the desired state. Geometry and rendering stay on the main thread.
export class BackgroundSolver {
  constructor({
    onInitial = () => {},
    onSnapshot = () => {},
    onProgress = () => {},
    onError = () => {},
    onCompletion = () => {},
    onCompletionError = () => {},
    createWorker = () =>
      new Worker(new URL("./solver-worker.mjs", import.meta.url), {
        type: "module",
      }),
  } = {}) {
    Object.assign(this, {
      onInitial,
      onSnapshot,
      onProgress,
      onError,
      onCompletion,
      onCompletionError,
      createWorker,
    });
    this.generation = 0;
    this.nextId = 1;
    this.worker = null;
    this.cache = new Map();
    this.ready = false;
    this.failed = false;
    this.inFlight = null;
    this.completionCache = new Map();
    this.completionVersion = 0;
    this.wantedCompletion = null;
  }

  load(boardId, fixedIds = []) {
    this.dispose();
    this.boardId = boardId;
    this.desired = [...fixedIds];
    this.desiredKey = stateKey(fixedIds);
    this.cache.clear();
    this.completionCache.clear();
    this.failed = false;
    this.lastError = null;
    const generation = this.generation;
    try {
      this.worker = this.createWorker();
      this.worker.onmessage = (event) => {
        if (generation === this.generation) this.receive(event.data);
      };
      this.worker.onerror = (event) => {
        if (generation !== this.generation) return;
        event.preventDefault?.();
        this.fail(event.message || "The background counter could not start.");
      };
      this.worker.onmessageerror = () => {
        if (generation === this.generation)
          this.fail("The background counter returned an unreadable result.");
      };
      this.send("init", [], { boardId });
    } catch (error) {
      this.fail(error.message);
    }
  }

  request(fixedIds) {
    this.cancelCompletion();
    this.desired = [...fixedIds];
    this.desiredKey = stateKey(fixedIds);
    const cached = this.cache.get(this.desiredKey);
    if (cached) {
      this.onSnapshot(this.desiredKey, cached);
      return cached;
    }
    if (this.failed) {
      this.onError(this.lastError);
      return null;
    }
    this.flush();
    return null;
  }

  // Comparison requests never change the arrangement whose count is desired.
  // A normal request or cancellation invalidates their callbacks immediately.
  requestCompletion(fixedIds, rank) {
    this.cancelCompletion();
    const key = stateKey(fixedIds);
    if (typeof rank !== "bigint") {
      this.onCompletionError("A completion rank must be a BigInt.");
      return null;
    }
    if (key !== this.desiredKey) {
      this.onCompletionError(
        "The arrangement changed. Choose a finish for the current board.",
      );
      return null;
    }
    const wanted = {
      key,
      rank,
      fixedIds: [...fixedIds],
      version: this.completionVersion,
      delivered: false,
    };
    this.wantedCompletion = wanted;
    const cached = this.cachedCompletion(wanted);
    if (cached !== undefined) {
      this.publishCompletion(wanted, cached);
      return cached === null ? null : [...cached];
    }
    if (this.failed) {
      wanted.delivered = true;
      this.onCompletionError(
        `${this.lastError} Retry the count to browse more finishes.`,
      );
      return null;
    }
    this.flush();
    return null;
  }

  cancelCompletion() {
    this.completionVersion += 1;
    this.wantedCompletion = null;
  }

  completionKey({ key, rank }) {
    return `${key}#${rank}`;
  }

  cachedCompletion(wanted) {
    const cacheKey = this.completionKey(wanted);
    if (this.completionCache.has(cacheKey))
      return this.completionCache.get(cacheKey);
    if (wanted.rank === 0n && this.cache.has(wanted.key))
      return this.cache.get(wanted.key).completion;
    return undefined;
  }

  publishCompletion(wanted, completion) {
    if (
      this.wantedCompletion !== wanted ||
      wanted.version !== this.completionVersion ||
      wanted.key !== this.desiredKey
    )
      return;
    wanted.delivered = true;
    if (completion === null)
      this.onCompletionError(
        "No complete tiling remains for this arrangement.",
      );
    else this.onCompletion(wanted.key, wanted.rank, [...completion]);
  }

  retry(fixedIds = this.desired) {
    this.load(this.boardId, fixedIds);
  }

  dispose() {
    this.generation += 1;
    this.cancelCompletion();
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.inFlight = null;
  }

  send(type, fixedIds, extra = {}) {
    const id = this.nextId++;
    this.inFlight = { id, type, key: stateKey(fixedIds), ...extra };
    try {
      this.worker.postMessage({ id, type, fixedIds: [...fixedIds], ...extra });
    } catch (error) {
      this.fail(error.message);
    }
  }

  flush() {
    if (!this.ready || this.failed || this.inFlight) return;
    if (!this.cache.has(this.desiredKey)) {
      this.send("analyze", this.desired);
      return;
    }
    const wanted = this.wantedCompletion;
    if (!wanted || wanted.delivered || wanted.key !== this.desiredKey) return;
    const cached = this.cachedCompletion(wanted);
    if (cached !== undefined) this.publishCompletion(wanted, cached);
    else
      this.send("completion", wanted.fixedIds, {
        rank: wanted.rank,
        version: wanted.version,
      });
  }

  receive(data) {
    const job = this.inFlight;
    if (!job || data.id !== job.id) return;
    if (data.type === "progress") {
      if (job.type !== "completion") this.onProgress(data.stats);
      return;
    }
    if (job.type === "completion") {
      if (data.type !== "completion" && data.type !== "error") return;
      this.inFlight = null;
      const wanted = this.wantedCompletion;
      const current =
        wanted &&
        job.version === wanted.version &&
        job.key === wanted.key &&
        job.rank === wanted.rank &&
        wanted.key === this.desiredKey;
      if (data.type === "error") {
        if (current) {
          wanted.delivered = true;
          this.onCompletionError(data.message);
        }
      } else if (data.rank === job.rank) {
        this.completionCache.set(this.completionKey(job), data.completion);
        if (this.completionCache.size > 32)
          this.completionCache.delete(this.completionCache.keys().next().value);
        if (current) this.publishCompletion(wanted, data.completion);
      }
      this.flush();
      return;
    }
    if (data.type === "error") {
      this.fail(data.message);
      return;
    }
    if (data.type !== "result") return;
    this.inFlight = null;
    this.cache.set(job.key, data);
    if (this.cache.size > 32) this.cache.delete(this.cache.keys().next().value);
    if (job.type === "init") {
      this.ready = true;
      this.onInitial(data.initialCount);
    }
    this.onSnapshot(job.key, data);
    // The desired arrangement may have changed while this job was running.
    const desiredResult = this.cache.get(this.desiredKey);
    if (job.key !== this.desiredKey && desiredResult)
      this.onSnapshot(this.desiredKey, desiredResult);
    this.flush();
  }

  fail(message) {
    const wanted = this.wantedCompletion;
    const notifyComparison =
      wanted && !wanted.delivered && wanted.key === this.desiredKey;
    this.dispose();
    this.failed = true;
    this.lastError = message || "The background count could not finish.";
    const known = this.cache.get(this.desiredKey);
    // A superseded search can hit its budget after the player has undone to
    // a cached arrangement. That exact result is still usable; only a later
    // uncached request needs to expose the stopped worker and retry control.
    if (known) this.onSnapshot(this.desiredKey, known);
    else this.onError(this.lastError);
    if (notifyComparison)
      this.onCompletionError(
        `${this.lastError} Retry the count to browse more finishes.`,
      );
  }
}
