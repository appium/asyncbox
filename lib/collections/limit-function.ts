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
  // Hand the slot directly to the next waiter so a new caller can't slip in between
  const release = () => {
    const waiter = queue.shift();
    if (waiter) {
      waiter();
    } else {
      active--;
    }
  };
  return async (...args) => {
    if (active < concurrency) {
      active++;
    } else {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    try {
      return await fn(...args);
    } finally {
      release();
    }
  };
}
