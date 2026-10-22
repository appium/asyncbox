import type {TestContext} from 'node:test';

/** Records the delay of every `setTimeout` call, still scheduling it as usual. */
export function recordTimeoutDelays(t: TestContext): number[] {
  const delays: number[] = [];
  const original = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', ((fn: () => void, ms?: number, ...args: unknown[]) => {
    delays.push(ms as number);
    return (original as any)(fn, ms, ...args);
  }) as any);
  return delays;
}

/** Wraps functions to measure how many of them run at the same time. */
export function createConcurrencyTracker() {
  let active = 0;
  let max = 0;
  return {
    get max(): number {
      return max;
    },
    wrap<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
      return async (...args: A) => {
        max = Math.max(max, ++active);
        try {
          return await fn(...args);
        } finally {
          active--;
        }
      };
    },
  };
}
