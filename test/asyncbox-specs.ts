import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
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
  PromiseCancellation,
  type SleepOptions,
} from '../lib/asyncbox.js';

use(chaiAsPromised);

describe('sleep', function () {
  it('should work like setTimeout', async function () {
    const now = Date.now();
    await sleep(20);
    expect(Date.now() - now).to.be.at.least(19);
  });
  it('should expose cancel on the promise', function () {
    const d = sleep(100);
    expect(d.cancel).to.be.a('function');
  });
  it('should reject with PromiseCancellation when cancelled', async function () {
    const d = sleep(10_000);
    d.cancel();
    await expect(d).to.be.rejectedWith(PromiseCancellation);
  });
  it('should reject immediately on cancel without waiting for ms', async function () {
    const d = sleep(10_000);
    const start = Date.now();
    d.cancel();
    await expect(d).to.be.rejectedWith(PromiseCancellation);
    expect(Date.now() - start).to.be.below(100);
  });
  it('should use default PromiseCancellation when cancelError is empty string', async function () {
    const d = sleep({ms: 10_000, cancelError: ''});
    d.cancel();
    try {
      await d;
      expect.fail('expected rejection');
    } catch (err: unknown) {
      expect(err).to.be.instanceOf(PromiseCancellation);
      expect((err as PromiseCancellation).message).to.equal('Promise cancelled');
    }
  });
  it('should reject with PromiseCancellation using cancelError string when cancelled', async function () {
    const d = sleep({ms: 10_000, cancelError: 'aborted'});
    d.cancel();
    try {
      await d;
      expect.fail('expected rejection');
    } catch (err: unknown) {
      expect(err).to.be.instanceOf(PromiseCancellation);
      expect((err as PromiseCancellation).message).to.equal('aborted');
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
      expect.fail('expected rejection');
    } catch (err: unknown) {
      expect(err).to.equal(customErr);
      expect(err).to.be.instanceOf(CustomCancel);
      expect((err as CustomCancel).message).to.equal('nope');
    }
  });
  it('should resolve when cancelled if cancelError is null', async function () {
    const d = sleep({ms: 10_000, cancelError: null});
    const start = Date.now();
    d.cancel();
    await d;
    expect(Date.now() - start).to.be.below(100);
  });
  it('should throw TypeError when ms is not finite', function () {
    expect(() => sleep(Number.NaN)).to.throw(TypeError, /finite number or a plain object/);
    expect(() => sleep(Number.POSITIVE_INFINITY)).to.throw(
      TypeError,
      /finite number or a plain object/,
    );
  });
  it('should throw TypeError when arg is not a number or plain object', function () {
    expect(() => sleep(null as unknown as number)).to.throw(
      TypeError,
      /finite number or a plain object/,
    );
    expect(() => sleep([] as unknown as number)).to.throw(
      TypeError,
      /finite number or a plain object/,
    );
  });
  it('should throw TypeError when plain object has invalid ms', function () {
    expect(() => sleep({} as unknown as SleepOptions)).to.throw(
      TypeError,
      /options\.ms must be a finite number/,
    );
    expect(() => sleep({ms: Number.NaN})).to.throw(
      TypeError,
      /options\.ms must be a finite number/,
    );
  });
  it('should accept a null-prototype plain object with ms', async function () {
    const o = Object.create(null) as {ms: number};
    o.ms = 20;
    const now = Date.now();
    await sleep(o);
    expect(Date.now() - now).to.be.at.least(19);
  });
});

describe('withTimeout', function () {
  function neverSettles<T>(): Promise<T> {
    return new Promise(() => {});
  }

  it('should resolve when the promise settles before the deadline', async function () {
    const result = await withTimeout(Promise.resolve(42), 1000);
    expect(result).to.equal(42);
  });
  it('should reject with TimeoutError when the deadline is exceeded', async function () {
    await expect(withTimeout(neverSettles<string>(), 30)).to.be.rejectedWith(TimeoutError);
  });
  it('should use the default TimeoutError message when none is provided', async function () {
    const timeoutMs = 20;
    try {
      await withTimeout(neverSettles<string>(), timeoutMs);
      expect.fail('expected rejection');
    } catch (err: unknown) {
      expect(err).to.be.instanceOf(TimeoutError);
      expect((err as TimeoutError).message).to.equal(`Operation timed out after ${timeoutMs}ms`);
    }
  });
  it('should use a custom message on TimeoutError when provided', async function () {
    try {
      await withTimeout(neverSettles<string>(), 20, 'custom timeout');
      expect.fail('expected rejection');
    } catch (err: unknown) {
      expect(err).to.be.instanceOf(TimeoutError);
      expect((err as TimeoutError).message).to.equal('custom timeout');
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
      expect.fail('expected rejection');
    } catch (err: unknown) {
      expect(err).to.equal(customErr);
      expect(err).to.be.instanceOf(CustomTimeout);
      expect((err as CustomTimeout).message).to.equal('overridden');
    }
  });
  it('should propagate rejection from the underlying promise before the deadline', async function () {
    const failing = (async () => {
      await sleep(10);
      throw new Error('boom');
    })();
    await expect(withTimeout(failing, 1000)).to.be.rejectedWith('boom');
  });
});

describe('longSleep', function () {
  it('should work like sleep in general', async function () {
    const now = Date.now();
    await longSleep(20);
    expect(Date.now() - now).to.be.at.least(19);
  });
  it('should work like sleep with values less than threshold', async function () {
    const now = Date.now();
    await longSleep(20, {thresholdMs: 100});
    expect(Date.now() - now).to.be.at.least(19);
  });
  it('should work like sleep with values above threshold, but quantized', async function () {
    const now = Date.now();
    await longSleep(50, {thresholdMs: 20, intervalMs: 40});
    expect(Date.now() - now).to.be.at.least(79);
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
      expect(elapsedMs).to.be.above(curElapsed);
      expect(timeLeft).to.be.below(curTimeLeft);
      expect(progress).to.be.above(curProgress);
      curElapsed = elapsedMs;
      curTimeLeft = timeLeft;
      curProgress = progress;
      callCount += 1;
    };
    const now = Date.now();
    await longSleep(500, {thresholdMs: 1, intervalMs: 100, progressCb});
    expect(Date.now() - now).to.be.above(49);
    expect(callCount).to.be.above(3);
    expect(curProgress >= 1).to.be.true;
    expect(curTimeLeft <= 0).to.be.true;
    expect(curElapsed >= 50).to.be.true;
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
    expect(res).to.equal(20);
    expect(Date.now() - start).to.be.at.least(14);
    expect(okFnCalls).to.equal(1);
  });
  it('should retry a failing function and eventually throw the same err', async function () {
    let err: Error | null = null;
    const start = Date.now();
    try {
      await retry(3, badFn);
    } catch (e) {
      err = e as Error;
    }
    expect(err).to.exist;
    expect(err!.message).to.equal('bad');
    expect(badFnCalls).to.equal(3);
    expect(Date.now() - start).to.be.at.least(44);
  });
  it('should return the correct value with a function that eventually passes', async function () {
    let err: Error | null = null;
    let start = Date.now();
    try {
      await retry(3, eventuallyOkFn, 4);
    } catch (e) {
      err = e as Error;
    }
    expect(err).to.exist;
    expect(err!.message).to.equal('not ok yet');
    expect(eventuallyOkFnCalls).to.equal(3);
    expect(Date.now() - start).to.be.above(35);

    // rerun with ok number of calls
    start = Date.now();
    eventuallyOkFnCalls = 0;
    const res = await retry(3, eventuallyOkFn, 3);
    expect(eventuallyOkFnCalls).to.equal(3);
    expect(res).to.equal(9);
    expect(Date.now() - start).to.be.above(35);
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
      expect(err).to.exist;
      expect(err!.message).to.equal('not ok yet');
      expect(eventuallyOkFnCalls).to.equal(3);
      expect(Date.now() - start).to.be.at.least(30);

      // rerun with ok number of calls
      start = Date.now();
      eventuallyOkFnCalls = 0;
      const res = await retryInterval(3, 15, eventuallyOkNoSleepFn, 3);
      expect(eventuallyOkFnCalls).to.equal(3);
      expect(res).to.equal(9);
      // XXX: flaky
      expect(Date.now() - start).to.be.at.least(30);
    });
    it('should not wait on the final error', async function () {
      const start = Date.now();
      try {
        await retryInterval(3, 2000, badFn);
      } catch {
        expect(Date.now() - start).to.be.below(4100);
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
    expect(duration).to.be.above(200);
    expect(duration).to.be.below(250);
    expect(result).to.be.true;
  });
  it('should wait and fail', async function () {
    const ref = Date.now();
    function condFn(): boolean {
      return Date.now() - ref > 200;
    }
    try {
      await waitForCondition(condFn, {waitMs: 100, intervalMs: 10});
      expect.fail('Should have thrown an error');
    } catch (err: any) {
      expect(err.message).to.match(/Condition unmet/);
    }
  });
  it('should reduce interval to not exceed timeout', async function () {
    const ref = Date.now();
    function condFn(): boolean {
      return Date.now() - ref > 25;
    }
    await waitForCondition(condFn, {waitMs: 30, intervalMs: 20});
    const duration = Date.now() - ref;
    expect(duration).to.be.below(35);
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
    expect(await asyncmap(coll, mapper, false)).to.eql(newColl);
    expect(Date.now() - start).to.be.at.least(50);
  });
  it('should map elements in parallel', async function () {
    const start = Date.now();
    expect(await asyncmap(coll, mapper)).to.eql(newColl);
    expect(Date.now() - start).to.be.at.most(20);
  });
  it('should map elements with concurrency', async function () {
    const start = Date.now();
    expect(await asyncmap(coll, mapper, {concurrency: 2})).to.eql(newColl);
    expect(Date.now() - start).to.be.at.least(29);
    expect(Date.now() - start).to.be.at.most(40);
  });
  it('should handle an empty array', async function () {
    expect(await asyncmap([], mapper, false)).to.eql([]);
  });
  it('should handle an empty array in parallel', async function () {
    expect(await asyncmap([], mapper)).to.eql([]);
  });
  it('should work for a sync mapper function', async function () {
    const syncmapper = (el: number): number => el * 2;
    expect(await asyncmap(coll, syncmapper, false)).to.eql(newColl);
    expect(await asyncmap(coll, syncmapper)).to.eql(newColl);
  });
  it('should raise an error if options is null', async function () {
    // @ts-expect-error - testing invalid inputs
    await expect(asyncmap(coll, mapper, null)).to.be.rejectedWith('Options cannot be null');
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
    expect(await asyncfilter(coll, filter, false)).to.eql(newColl);
    expect(Date.now() - start).to.be.at.least(50);
  });
  it('should filter elements in parallel', async function () {
    const start = Date.now();
    expect(await asyncfilter(coll, filter)).to.eql(newColl);
    expect(Date.now() - start).to.be.at.most(20);
  });
  it('should filter elements with concurrency', async function () {
    const start = Date.now();
    expect(await asyncfilter(coll, filter, {concurrency: 2})).to.eql(newColl);
    expect(Date.now() - start).to.be.at.least(29);
    expect(Date.now() - start).to.be.at.most(40);
  });
  it('should handle an empty array', async function () {
    expect(await asyncfilter([], filter, false)).to.eql([]);
  });
  it('should handle an empty array in parallel', async function () {
    expect(await asyncfilter([], filter)).to.eql([]);
  });
  it('should work for a sync filter function', async function () {
    const syncfilter = (el: number): boolean => el % 2 === 0;
    expect(await asyncfilter(coll, syncfilter, false)).to.eql(newColl);
    expect(await asyncfilter(coll, syncfilter)).to.eql(newColl);
  });
  it('should raise an error if options is null', async function () {
    // @ts-expect-error - testing invalid inputs
    await expect(asyncfilter(coll, filter, null)).to.be.rejectedWith('Options cannot be null');
  });
});
