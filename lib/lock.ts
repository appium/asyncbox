import {AsyncResource} from 'node:async_hooks';

const DEFAULT_MAX_PENDING = 1000;
// setTimeout fires after 1 ms for anything above this
const MAX_TIMER_MS = 2 ** 31 - 1;

/** Options shared by the {@link AsyncLock} constructor and {@link AsyncLock.acquire}. */
export interface AsyncLockOptions {
  /**
   * Max ms a task may wait in the queue before failing. `0` means never.
   * @default 0
   */
  timeout?: number;
  /**
   * Max ms between calling `acquire` and the task finishing (queue wait included). `0` means never.
   * @default 0
   */
  maxOccupationTime?: number;
  /**
   * Max ms the task may run once it holds the lock; the lock is then released. `0` means never.
   * @default 0
   */
  maxExecutionTime?: number;
  /**
   * Max number of tasks waiting per key; further ones are rejected right away. `0` rejects every
   * task that would have to wait.
   * @default 1000
   */
  maxPending?: number;
}

/** Per-call options of {@link AsyncLock.acquire}; override the constructor ones. */
export interface AcquireOptions extends AsyncLockOptions {
  /**
   * Put the task at the front of the queue instead of the back.
   * @default false
   */
  skipQueue?: boolean;
}

type Task<T> = () => T | PromiseLike<T>;
type Outcome<T> = {value: T} | {error: unknown};
type Queues = Map<string, Array<() => void>>;
type ResolvedOptions = Required<AsyncLockOptions> & {skipQueue?: boolean};
type ClaimOptions = Pick<ResolvedOptions, 'timeout' | 'maxPending' | 'skipQueue'>;

/**
 * Promise-based mutex keyed by string. Tasks with the same key run one at a time, in FIFO order.
 *
 * Each task runs in the async context (`AsyncLocalStorage`) of the code that called
 * {@link AsyncLock.acquire}, not in the context of the task that held the lock before it.
 */
export class AsyncLock {
  private readonly queues: Queues = new Map();
  private readonly defaults: Required<AsyncLockOptions>;

  constructor(opts: AsyncLockOptions = {}) {
    validateOptions(opts);
    this.defaults = {
      timeout: 0,
      maxOccupationTime: 0,
      maxExecutionTime: 0,
      maxPending: DEFAULT_MAX_PENDING,
      ...stripUndefined(opts),
    };
  }

  /**
   * Run `fn` once the lock for `key` is free and release the lock when it settles.
   *
   * Multiple keys are held together. They are acquired one by one in sorted order, whatever order
   * they are given in, so that overlapping calls cannot deadlock; duplicates are ignored. Keys that
   * are already held stay held while a later one is awaited. `timeout` and `maxOccupationTime` are
   * budgets for the whole call, while `maxExecutionTime` counts from the moment all the keys are
   * held and releases all of them.
   *
   * @param key - Resource key, or a non-empty array of keys
   * @param fn - Task to run while holding the lock; may be sync or async
   * @param opts - Per-call options
   * @returns The result of `fn`
   * @throws {TypeError} Synchronously, if an argument is invalid
   */
  acquire<T>(key: string | readonly string[], fn: Task<T>, opts: AcquireOptions = {}): Promise<T> {
    if (typeof fn !== 'function') {
      throw new TypeError('You must pass a function to execute');
    }
    if (
      typeof key !== 'string' &&
      !(Array.isArray(key) && key.length > 0 && [...key].every((k) => typeof k === 'string'))
    ) {
      throw new TypeError('The key must be a string or a non-empty array of strings');
    }
    validateOptions(opts);
    // A canonical order keeps overlapping multi-key calls, e.g. ['a', 'b'] and ['b', 'a'], from deadlocking
    const keys = typeof key === 'string' ? [key] : [...new Set(key)].sort();
    const acquisition = new Acquisition(this.queues, keys, fn, {...this.defaults, ...stripUndefined(opts)});
    acquisition.enqueue();
    return acquisition.promise;
  }

  /**
   * Number of tasks waiting for `key`, not counting the running one.
   *
   * @param key - Resource key
   */
  getQueueLength(key: string): number {
    return this.queues.get(key)?.length ?? 0;
  }

  /**
   * Whether `key` has a running or pending task. Without a key, whether any key does.
   *
   * @param key - Resource key
   */
  isBusy(key?: string): boolean {
    return key === undefined ? this.queues.size > 0 : this.queues.has(key);
  }
}

/** The place of one acquisition in the queue of one key; once granted, it holds the key. */
class KeyClaim {
  private holding = false;
  private dropped = false;
  private queueTimer?: NodeJS.Timeout;

  constructor(
    private readonly queues: Queues,
    private readonly key: string,
    private readonly opts: ClaimOptions,
    private readonly onGranted: () => void,
    private readonly onDenied: (error: Error) => void,
  ) {}

  /**
   * Take the key right away if it is free, otherwise wait in its queue.
   *
   * @returns Whether the key is held. If not, `onGranted` is called once it is, unless the claim
   * is denied.
   */
  join(): boolean {
    const {timeout, maxPending, skipQueue} = this.opts;
    const queue = this.queues.get(this.key);
    if (!queue) {
      this.queues.set(this.key, []);
      this.holding = true;
      return true;
    }
    if (queue.length >= maxPending) {
      this.onDenied(new Error(`Too many pending tasks in queue ${this.key}`));
    } else {
      if (skipQueue) {
        queue.unshift(this.grant);
      } else {
        queue.push(this.grant);
      }
      if (timeout) {
        this.queueTimer = setTimeout(
          () => this.onDenied(new Error(`async-lock timed out in queue ${this.key}`)),
          timeout,
        );
      }
    }
    return false;
  }

  /**
   * Leave the queue, or release the key if it is held. Idempotent.
   *
   * @returns The handover of the key to its next waiter. The caller must run it only after it
   * has released all of its keys, so that no waiter starts while a batch is partially released.
   */
  drop(): (() => void) | undefined {
    if (this.dropped) {
      return undefined;
    }
    this.dropped = true;
    clearTimeout(this.queueTimer);
    if (this.holding) {
      return this.releaseKey();
    }
    const queue = this.queues.get(this.key);
    const idx = queue?.indexOf(this.grant) ?? -1;
    if (idx >= 0) {
      queue?.splice(idx, 1);
    }
    return undefined;
  }

  private releaseKey(): (() => void) | undefined {
    const next = this.queues.get(this.key)?.shift();
    if (!next) {
      this.queues.delete(this.key);
    }
    return next;
  }

  // An arrow function, because this exact reference sits in the queue and is removed by drop()
  private readonly grant = (): void => {
    clearTimeout(this.queueTimer);
    this.holding = true;
    if (this.dropped) {
      // Dropped while the key was being handed over to it: pass the key on instead of using it
      this.releaseKey()?.();
      return;
    }
    this.onGranted();
  };
}

/**
 * One `acquire` call: its promise, its timers and its claims on all of its keys. The keys are
 * claimed one by one, the task runs once all of them are held and they are released together.
 */
class Acquisition<T> {
  readonly promise: Promise<T>;
  private resolve!: (value: T) => void;
  private reject!: (error: unknown) => void;
  private readonly task: Task<T>;
  private readonly claims: KeyClaim[] = [];
  private running = false;
  private settled = false;
  private queueDeadline = 0;
  private occupationTimer?: NodeJS.Timeout;
  private executionTimer?: NodeJS.Timeout;

  constructor(
    private readonly queues: Queues,
    private readonly keys: string[],
    task: Task<T>,
    private readonly opts: ResolvedOptions,
  ) {
    // Queued tasks are started from the previous task's promise chain; bind to keep our context
    this.task = AsyncResource.bind(task);
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  /** Start the task right away if all the keys are free, otherwise wait for them. */
  enqueue(): void {
    const {timeout, maxOccupationTime} = this.opts;
    if (timeout) {
      this.queueDeadline = performance.now() + timeout;
    }
    if (maxOccupationTime) {
      this.occupationTimer = setTimeout(() => this.expire(), maxOccupationTime);
    }
    this.claimKeys(0);
  }

  // Free keys are claimed in a loop, not recursively, so that a large batch cannot overflow the stack
  private claimKeys(from: number): void {
    const {maxPending, skipQueue} = this.opts;
    try {
      for (let index = from; index < this.keys.length; index++) {
        // The queue timeout is a budget for waiting for all the keys, not for each one
        const timeout = this.queueDeadline ? Math.max(this.queueDeadline - performance.now(), 1) : 0;
        const claim = new KeyClaim(
          this.queues,
          this.keys[index],
          {timeout, maxPending, skipQueue},
          () => this.claimKeys(index + 1),
          (error) => this.abort(error),
        );
        this.claims.push(claim);
        if (!claim.join()) {
          return;
        }
      }
      this.execute();
    } catch (error) {
      this.abort(error);
    }
  }

  private execute(): void {
    const {maxExecutionTime} = this.opts;
    this.running = true;
    if (maxExecutionTime) {
      this.executionTimer = setTimeout(
        () => this.abort(new Error(`Maximum execution time is exceeded ${this.keys.join(', ')}`)),
        maxExecutionTime,
      );
    }
    new Promise<T>((resolve) => resolve(this.task())).then(
      (value) => this.finish({value}),
      (error) => this.finish({error}),
    );
  }

  private finish(outcome: Outcome<T>): void {
    this.settle(outcome);
    this.release();
  }

  // Reject and release all the keys; a running task is left to finish on its own
  private abort(error: unknown): void {
    this.settle({error});
    this.release();
  }

  // A running task keeps its keys until it finishes, an unstarted one gives them up
  private expire(): void {
    const keys = this.keys.join(', ');
    if (this.running) {
      this.settle({error: new Error(`Maximum occupation time is exceeded while executing ${keys}`)});
    } else {
      this.abort(new Error(`Maximum occupation time is exceeded in queue ${keys}`));
    }
  }

  private settle(outcome: Outcome<T>): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    clearTimeout(this.occupationTimer);
    if ('error' in outcome) {
      this.reject(outcome.error);
    } else {
      this.resolve(outcome.value);
    }
  }

  // Idempotent, so a task that outlives its execution timeout cannot release the keys twice
  private release(): void {
    clearTimeout(this.executionTimer);
    const handovers = this.claims
      .splice(0)
      .reverse()
      .map((claim) => claim.drop());
    for (const handover of handovers) {
      handover?.();
    }
  }
}

function validateOptions(opts: AcquireOptions): void {
  if (opts === null || typeof opts !== 'object') {
    throw new TypeError('The options must be an object');
  }
  for (const name of ['timeout', 'maxOccupationTime', 'maxExecutionTime'] as const) {
    const value = opts[name];
    if (value !== undefined && !(Number.isFinite(value) && value >= 0 && value <= MAX_TIMER_MS)) {
      throw new TypeError(`${name} must be a number of milliseconds between 0 and ${MAX_TIMER_MS}`);
    }
  }
  if (opts.skipQueue !== undefined && typeof opts.skipQueue !== 'boolean') {
    throw new TypeError('skipQueue must be a boolean');
  }
  const {maxPending} = opts;
  if (maxPending !== undefined && maxPending !== Infinity && !(Number.isInteger(maxPending) && maxPending >= 0)) {
    throw new TypeError('maxPending must be a non-negative integer or Infinity');
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
