/**
 * Wraps `fn` so at most `concurrency` calls run at once; extra calls queue in FIFO order.
 */
export function limitFunction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  {concurrency}: {concurrency: number},
): (...args: A) => Promise<R> {
  if (!((Number.isInteger(concurrency) || concurrency === Infinity) && concurrency > 0)) {
    throw new TypeError('Expected `concurrency` to be a number from 1 and up');
  }
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    active--;
    queue.shift()?.();
  };
  return async (...args) => {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn(...args);
    } finally {
      next();
    }
  };
}
