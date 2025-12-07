import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  sleep,
  longSleep,
  retry,
  retryInterval,
  nodeify,
  nodeifyAll,
  parallel,
  asyncmap,
  asyncfilter,
  waitForCondition,
} from '../lib/asyncbox.js';
import B from 'bluebird';
import sinon from 'sinon';

use(chaiAsPromised);

describe('sleep', function () {
  it('should work like setTimeout', async function () {
    const now = Date.now();
    await sleep(20);
    expect(Date.now() - now).to.be.at.least(19);
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
    const progressCb = function ({elapsedMs, timeLeft, progress}: {elapsedMs: number, timeLeft: number, progress: number}) {
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

describe('nodeifyAll', function () {
  const asyncFn = async function (val: string): Promise<string> {
    await sleep(15);
    return val;
  };
  const asyncFn2 = async function (val: string): Promise<string[]> {
    await sleep(15);
    return [val, val + val];
  };
  const badAsyncFn = async function (): Promise<never> {
    await sleep(15);
    throw new Error('boo');
  };
  const cbMap = nodeifyAll({asyncFn, asyncFn2, badAsyncFn});
  it('should turn async functions into nodey things', function (done) {
    const start = Date.now();
    nodeify(asyncFn('foo'), function (err: Error | null, val?: string, val2?: string) { // eslint-disable-line promise/prefer-await-to-callbacks
      expect(err).to.not.exist;
      expect(val2).to.not.exist;
      expect(val!).to.equal('foo');
      expect(Date.now() - start).to.be.at.least(14);
      done();
    });
  });
  it('should turn async functions into nodey things via nodeifyAll', function (done) {
    const start = Date.now();
    cbMap.asyncFn('foo', function (err: Error | null, val?: string, val2?: string) { // eslint-disable-line promise/prefer-await-to-callbacks
      expect(err).to.not.exist;
      expect(val2).to.not.exist;
      expect(val!).to.equal('foo');
      expect(Date.now() - start).to.be.at.least(14);
      done();
    });
  });
  it('should turn async functions into nodey things with mult params', function (done) {
    const start = Date.now();
    nodeify(asyncFn2('foo'), function (err: Error | null, val?: string[]) { // eslint-disable-line promise/prefer-await-to-callbacks
      expect(err).to.not.exist;
      expect(val!).to.eql(['foo', 'foofoo']);
      expect(Date.now() - start).to.be.at.least(14);
      done();
    });
  });
  it('should handle errors correctly', function (done) {
    const start = Date.now();
    nodeify(badAsyncFn(), function (err: Error | null, val?: string) { // eslint-disable-line promise/prefer-await-to-callbacks
      expect(val).to.not.exist;
      expect(err!.message).to.equal('boo');
      expect(Date.now() - start).to.be.at.least(14);
      done();
    });
  });
});

describe('parallel', function () {
  const asyncFn = async function (val: number): Promise<number> {
    await sleep(50);
    return val;
  };
  const badAsyncFn = async function (): Promise<never> {
    await sleep(20);
    throw new Error('boo');
  };
  it('should perform tasks in parallel and return results', async function () {
    const vals = [1, 2, 3];
    const promises: Promise<number>[] = [];
    const start = Date.now();
    for (const v of vals) {
      promises.push(asyncFn(v));
    }
    const res = await parallel(promises);
    expect(Date.now() - start).to.be.at.least(49);
    expect(Date.now() - start).to.be.below(59);
    expect(res.sort()).to.eql([1, 2, 3]);
  });
  it('should error with first response', async function () {
    const vals = [1, 2, 3];
    const promises: Promise<number>[] = [];
    const start = Date.now();
    for (const v of vals) {
      promises.push(asyncFn(v));
    }
    promises.push(badAsyncFn());
    let err: Error | null = null;
    let res: number[] = [];
    try {
      res = await parallel(promises);
    } catch (e) {
      err = e as Error;
    }
    expect(Date.now() - start).to.be.at.least(19);
    expect(Date.now() - start).to.be.below(49);
    expect(err).to.exist;
    expect(res).to.eql([]);
  });

  describe('waitForCondition', function () {
    let requestSpy: sinon.SinonSpy;
    beforeEach(function () {
      requestSpy = sinon.spy(B, 'delay');
    });
    afterEach(function () {
      requestSpy.restore();
    });
    it('should wait and succeed', async function () {
      const ref = Date.now();
      function condFn (): boolean {
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
      function condFn (): boolean {
        return Date.now() - ref > 200;
      }
      try {
        await waitForCondition(condFn, {waitMs: 100, intervalMs: 10});
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.match(/Condition unmet/);
      }
    });
    it('should not exceed implicit wait timeout', async function () {
      const ref = Date.now();
      function condFn (): boolean {
        return Date.now() - ref > 15;
      }
      await (waitForCondition(condFn, {waitMs: 20, intervalMs: 10}));
      const getLastCall = requestSpy.getCall(1);
      expect(getLastCall.args[0]).to.be.at.most(10);
    });
  });
});

describe('asyncmap', function () {
  const mapper = async function (el: number): Promise<number> {
    await sleep(10);
    return el * 2;
  };
  const coll = [1, 2, 3];
  it('should map elements one at a time', async function () {
    const start = Date.now();
    expect(await asyncmap(coll, mapper, false)).to.eql([2, 4, 6]);
    expect(Date.now() - start).to.be.at.least(30);
  });
  it('should map elements in parallel', async function () {
    const start = Date.now();
    expect(await asyncmap(coll, mapper)).to.eql([2, 4, 6]);
    expect(Date.now() - start).to.be.at.most(20);
  });
  it('should handle an empty array', async function () {
    expect(await asyncmap([], mapper, false)).to.eql([]);
  });
  it('should handle an empty array in parallel', async function () {
    expect(await asyncmap([], mapper)).to.eql([]);
  });
});

describe('asyncfilter', function () {
  const filter = async function (el: number): Promise<boolean> {
    await sleep(5);
    return el % 2 === 0;
  };
  const coll = [1, 2, 3, 4, 5];
  it('should filter elements one at a time', async function () {
    const start = Date.now();
    expect(await asyncfilter(coll, filter, false)).to.eql([2, 4]);
    expect(Date.now() - start).to.be.at.least(19);
  });
  it('should filter elements in parallel', async function () {
    const start = Date.now();
    expect(await asyncfilter(coll, filter)).to.eql([2, 4]);
    expect(Date.now() - start).to.be.below(9);
  });
  it('should handle an empty array', async function () {
    const start = Date.now();
    expect(await asyncfilter([], filter, false)).to.eql([]);
    expect(Date.now() - start).to.be.below(9);
  });
  it('should handle an empty array in parallel', async function () {
    const start = Date.now();
    expect(await asyncfilter([], filter)).to.eql([]);
    expect(Date.now() - start).to.be.below(9);
  });
});
