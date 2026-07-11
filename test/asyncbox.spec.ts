import {
  sleep,
  longSleep,
  retry,
  retryInterval,
  asyncmap,
  asyncfilter,
  waitForCondition,
  withTimeout,
  TimeoutError,
  PromiseCancellationError,
  type SleepOptions,
} from '../lib/asyncbox.js';
import {it, describe, beforeEach} from 'node:test';
import assert from 'node:assert/strict';

describe('sleep', function () {
  it('should work like setTimeout', async function () {
    const now = Date.now();
    await sleep(20);
    assert.ok(Date.now() - now >= 19);
  });
  it('should expose cancel on the promise', function () {
    const d = sleep(100);
    assert.ok(typeof d.cancel === 'function');
  });
  it('should reject with PromiseCancellationError when cancelled', async function () {
    const d = sleep(10_000);
    d.cancel();
    await assert.rejects(d, PromiseCancellationError);
  });
  it('should reject immediately on cancel without waiting for ms', async function () {
    const d = sleep(10_000);
    const start = Date.now();
    d.cancel();
    await assert.rejects(d, PromiseCancellationError);
    assert.ok(Date.now() - start < 100);
  });
  it('should use default PromiseCancellationError when cancelError is empty string', async function () {
    const d = sleep({ms: 10_000, cancelError: ''});
    d.cancel();
    try {
      await d;
      assert.fail('expected rejection');
    } catch (err: unknown) {
      assert.ok(err instanceof PromiseCancellationError);
      assert.strictEqual((err as PromiseCancellationError).message, 'Promise cancelled');
    }
  });
  it('should reject with PromiseCancellationError using cancelError string when cancelled', async function () {
    const d = sleep({ms: 10_000, cancelError: 'aborted'});
    d.cancel();
    try {
      await d;
      assert.fail('expected rejection');
    } catch (err: unknown) {
      assert.ok(err instanceof PromiseCancellationError);
      assert.strictEqual((err as PromiseCancellationError).message, 'aborted');
    }
  });
  it('should reject with a provided Error instance on cancel', async function () {
    class CustomCancel extends Error {
      constructor(message?: string) {
        super(message ?? 'custom default');
        this.name = 'CustomCancel';
      }
    }
    const customErr = new CustomCancel('nope');
    const d = sleep({ms: 10_000, cancelError: customErr});
    d.cancel();
    try {
      await d;
      assert.fail('expected rejection');
    } catch (err: unknown) {
      assert.strictEqual(err, customErr);
      assert.ok(err instanceof CustomCancel);
      assert.strictEqual((err as CustomCancel).message, 'nope');
    }
  });
  it('should resolve when cancelled if cancelError is null', async function () {
    const d = sleep({ms: 10_000, cancelError: null});
    const start = Date.now();
    d.cancel();
    await d;
    assert.ok(Date.now() - start < 100);
  });
  it('should throw TypeError when ms is not finite', function () {
    assert.throws(() => sleep(Number.NaN), /finite number or an object with ms/);
    assert.throws(() => sleep(Number.POSITIVE_INFINITY), /finite number or an object with ms/);
  });
  it('should throw TypeError when arg is not a number or object', function () {
    assert.throws(() => sleep(null as unknown as number), /finite number or an object with ms/);
    assert.throws(() => sleep([] as unknown as number), /finite number or an object with ms/);
  });
  it('should throw TypeError when object has invalid ms', function () {
    assert.throws(
      () => sleep({} as unknown as SleepOptions),
      /options\.ms must be a finite number/,
    );
    assert.throws(() => sleep({ms: Number.NaN}), /options\.ms must be a finite number/);
  });
  it('should accept a null-prototype object with ms', async function () {
    const o = Object.create(null) as {ms: number};
    o.ms = 20;
    const now = Date.now();
    await sleep(o);
    assert.ok(Date.now() - now >= 19);
  });
  it('should accept a class instance that satisfies SleepOptions', async function () {
    class Opts implements SleepOptions {
      ms = 25;
    }
    const now = Date.now();
    await sleep(new Opts());
    assert.ok(Date.now() - now >= 24);
  });
});

describe('withTimeout', function () {
  function neverSettles<T>(): Promise<T> {
    return new Promise(() => {});
  }

  it('should resolve when the promise settles before the deadline', async function () {
    const result = await withTimeout(Promise.resolve(42), 1000);
    assert.strictEqual(result, 42);
  });
  it('should reject with TimeoutError when the deadline is exceeded', async function () {
    await assert.rejects(withTimeout(neverSettles<string>(), 30), TimeoutError);
  });
  it('should use the default TimeoutError message when none is provided', async function () {
    const timeoutMs = 20;
    try {
      await withTimeout(neverSettles<string>(), timeoutMs);
      assert.fail('expected rejection');
    } catch (err: unknown) {
      assert.ok(err instanceof TimeoutError);
      assert.strictEqual((err as TimeoutError).message, `Operation timed out after ${timeoutMs}ms`);
    }
  });
  it('should use a custom message on TimeoutError when provided', async function () {
    try {
      await withTimeout(neverSettles<string>(), 20, 'custom timeout');
      assert.fail('expected rejection');
    } catch (err: unknown) {
      assert.ok(err instanceof TimeoutError);
      assert.strictEqual((err as TimeoutError).message, 'custom timeout');
    }
  });
  it('should reject with a provided Error instance on timeout', async function () {
    class CustomTimeout extends Error {
      constructor(message?: string) {
        super(message ?? 'custom default');
        this.name = 'CustomTimeout';
      }
    }
    const customErr = new CustomTimeout('overridden');
    try {
      await withTimeout(neverSettles<string>(), 20, customErr);
      assert.fail('expected rejection');
    } catch (err: unknown) {
      assert.strictEqual(err, customErr);
      assert.ok(err instanceof CustomTimeout);
      assert.strictEqual((err as CustomTimeout).message, 'overridden');
    }
  });
  it('should propagate rejection from the underlying promise before the deadline', async function () {
    const failing = (async () => {
      await sleep(10);
      throw new Error('boom');
    })();
    await assert.rejects(withTimeout(failing, 1000), /boom/);
  });
});

describe('longSleep', function () {
  it('should work like sleep in general', async function () {
    const now = Date.now();
    await longSleep(20);
    assert.ok(Date.now() - now >= 19);
  });
  it('should work like sleep with values less than threshold', async function () {
    const now = Date.now();
    await longSleep(20, {thresholdMs: 100});
    assert.ok(Date.now() - now >= 19);
  });
  it('should work like sleep with values above threshold, but quantized', async function () {
    const now = Date.now();
    await longSleep(50, {thresholdMs: 20, intervalMs: 40});
    assert.ok(Date.now() - now >= 79);
  });
  it('should trigger a progress callback if specified', async function () {
    let callCount = 0;
    let curElapsed = 0;
    let curTimeLeft = 10000;
    let curProgress = 0;
    const progressCb = function ({
      elapsedMs,
      timeLeft,
      progress,
    }: {
      elapsedMs: number;
      timeLeft: number;
      progress: number;
    }) {
      assert.ok(elapsedMs > curElapsed);
      assert.ok(timeLeft < curTimeLeft);
      assert.ok(progress > curProgress);
      curElapsed = elapsedMs;
      curTimeLeft = timeLeft;
      curProgress = progress;
      callCount += 1;
    };
    const now = Date.now();
    await longSleep(500, {thresholdMs: 1, intervalMs: 100, progressCb});
    assert.ok(Date.now() - now > 49);
    assert.ok(callCount > 3);
    assert.ok(curProgress >= 1);
    assert.ok(curTimeLeft <= 0);
    assert.ok(curElapsed >= 50);
  });
});

describe('retry', function () {
  let okFnCalls = 0;
  const okFn = async function (val1: number, val2: number): Promise<number> {
    await sleep(15);
    okFnCalls++;
    return val1 * val2;
  };
  let badFnCalls = 0;
  const badFn = async function (): Promise<never> {
    await sleep(15);
    badFnCalls++;
    throw new Error('bad');
  };
  let eventuallyOkFnCalls = 0;
  const eventuallyOkFn = async function (times: number): Promise<number> {
    await sleep(15);
    eventuallyOkFnCalls++;
    if (eventuallyOkFnCalls < times) {
      throw new Error('not ok yet');
    }
    return times * times;
  };
  const eventuallyOkNoSleepFn = async function (times: number): Promise<number> {
    eventuallyOkFnCalls++;
    if (eventuallyOkFnCalls < times) {
      throw new Error('not ok yet');
    }
    return times * times;
  };
  beforeEach(function () {
    okFnCalls = 0;
    badFnCalls = 0;
    eventuallyOkFnCalls = 0;
  });
  it('should return the result of a passing function', async function () {
    const start = Date.now();
    const res = await retry(3, okFn, 5, 4);
    assert.strictEqual(res, 20);
    assert.ok(Date.now() - start >= 14);
    assert.strictEqual(okFnCalls, 1);
  });
  it('should retry a failing function and eventually throw the same err', async function () {
    let err: Error | null = null;
    const start = Date.now();
    try {
      await retry(3, badFn);
    } catch (e) {
      err = e as Error;
    }
    assert.ok(err);
    assert.strictEqual(err!.message, 'bad');
    assert.strictEqual(badFnCalls, 3);
    assert.ok(Date.now() - start >= 44);
  });
  it('should return the correct value with a function that eventually passes', async function () {
    let err: Error | null = null;
    let start = Date.now();
    try {
      await retry(3, eventuallyOkFn, 4);
    } catch (e) {
      err = e as Error;
    }
    assert.ok(err);
    assert.strictEqual(err!.message, 'not ok yet');
    assert.strictEqual(eventuallyOkFnCalls, 3);
    assert.ok(Date.now() - start > 35);

    // rerun with ok number of calls
    start = Date.now();
    eventuallyOkFnCalls = 0;
    const res = await retry(3, eventuallyOkFn, 3);
    assert.strictEqual(eventuallyOkFnCalls, 3);
    assert.strictEqual(res, 9);
    assert.ok(Date.now() - start > 35);
  });
  describe('retryInterval', function () {
    it('should return the correct value with a function that eventually passes', async function () {
      eventuallyOkFnCalls = 0;
      let err: Error | null = null;
      let start = Date.now();
      try {
        await retryInterval(3, 15, eventuallyOkNoSleepFn, 4);
      } catch (e) {
        err = e as Error;
      }
      assert.ok(err);
      assert.strictEqual(err!.message, 'not ok yet');
      assert.strictEqual(eventuallyOkFnCalls, 3);
      assert.ok(Date.now() - start >= 30);

      // rerun with ok number of calls
      start = Date.now();
      eventuallyOkFnCalls = 0;
      const res = await retryInterval(3, 15, eventuallyOkNoSleepFn, 3);
      assert.strictEqual(eventuallyOkFnCalls, 3);
      assert.strictEqual(res, 9);
      assert.ok(Date.now() - start >= 30);
    });
    it('should not wait on the final error', async function () {
      const start = Date.now();
      try {
        await retryInterval(3, 2000, badFn);
      } catch {
        assert.ok(Date.now() - start < 4100);
      }
    });
  });
});

describe('waitForCondition', function () {
  it('should wait and succeed', async function () {
    const ref = Date.now();
    function condFn(): boolean {
      return Date.now() - ref > 200;
    }
    const result = await waitForCondition(condFn, {waitMs: 1000, intervalMs: 10});
    const duration = Date.now() - ref;
    assert.ok(duration > 200);
    assert.ok(duration < 250);
    assert.ok(result);
  });
  it('should wait and fail', async function () {
    const ref = Date.now();
    function condFn(): boolean {
      return Date.now() - ref > 200;
    }
    try {
      await waitForCondition(condFn, {waitMs: 100, intervalMs: 10});
      assert.fail('Should have thrown an error');
    } catch (err: any) {
      assert.ok(err.message.match(/Condition unmet/));
    }
  });
  it('should reduce interval to not exceed timeout', async function () {
    const ref = Date.now();
    function condFn(): boolean {
      return Date.now() - ref > 25;
    }
    await waitForCondition(condFn, {waitMs: 30, intervalMs: 20});
    const duration = Date.now() - ref;
    assert.ok(duration < 35);
  });
});

describe('asyncmap', function () {
  const mapper = async function (el: number): Promise<number> {
    await sleep(10);
    return el * 2;
  };
  const coll = [1, 2, 3, 4, 5];
  const newColl = [2, 4, 6, 8, 10];
  it('should map elements one at a time', async function () {
    const start = Date.now();
    assert.deepStrictEqual(await asyncmap(coll, mapper, false), newColl);
    assert.ok(Date.now() - start >= 50);
  });
  it('should map elements in parallel', async function () {
    const start = Date.now();
    assert.deepStrictEqual(await asyncmap(coll, mapper), newColl);
    assert.ok(Date.now() - start <= 20);
  });
  it('should map elements with concurrency', async function () {
    const start = Date.now();
    assert.deepStrictEqual(await asyncmap(coll, mapper, {concurrency: 2}), newColl);
    assert.ok(Date.now() - start >= 29);
    assert.ok(Date.now() - start <= 40);
  });
  it('should handle an empty array', async function () {
    assert.deepStrictEqual(await asyncmap([], mapper, false), []);
  });
  it('should handle an empty array in parallel', async function () {
    assert.deepStrictEqual(await asyncmap([], mapper), []);
  });
  it('should work for a sync mapper function', async function () {
    const syncmapper = (el: number): number => el * 2;
    assert.deepStrictEqual(await asyncmap(coll, syncmapper, false), newColl);
    assert.deepStrictEqual(await asyncmap(coll, syncmapper), newColl);
  });
  it('should raise an error if options is null', async function () {
    await assert.rejects(() => asyncmap(coll, mapper, null as any), /Options cannot be null/);
  });
});

describe('asyncfilter', function () {
  const filter = async function (el: number): Promise<boolean> {
    await sleep(10);
    return el % 2 === 0;
  };
  const coll = [1, 2, 3, 4, 5];
  const newColl = [2, 4];
  it('should filter elements one at a time', async function () {
    const start = Date.now();
    assert.deepStrictEqual(await asyncfilter(coll, filter, false), newColl);
    assert.ok(Date.now() - start >= 50);
  });
  it('should filter elements in parallel', async function () {
    const start = Date.now();
    assert.deepStrictEqual(await asyncfilter(coll, filter), newColl);
    assert.ok(Date.now() - start <= 20);
  });
  it('should filter elements with concurrency', async function () {
    const start = Date.now();
    assert.deepStrictEqual(await asyncfilter(coll, filter, {concurrency: 2}), newColl);
    assert.ok(Date.now() - start >= 29);
    assert.ok(Date.now() - start <= 40);
  });
  it('should handle an empty array', async function () {
    assert.deepStrictEqual(await asyncfilter([], filter, false), []);
  });
  it('should handle an empty array in parallel', async function () {
    assert.deepStrictEqual(await asyncfilter([], filter), []);
  });
  it('should work for a sync filter function', async function () {
    const syncfilter = (el: number): boolean => el % 2 === 0;
    assert.deepStrictEqual(await asyncfilter(coll, syncfilter, false), newColl);
    assert.deepStrictEqual(await asyncfilter(coll, syncfilter), newColl);
  });
  it('should raise an error if options is null', async function () {
    await assert.rejects(() => asyncfilter(coll, filter, null as any), /Options cannot be null/);
  });
});
