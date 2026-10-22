import assert from 'node:assert/strict';
import {beforeEach, describe, it} from 'node:test';

import {retry, retryInterval} from '../lib/retry.js';
import {sleep} from '../lib/sleep.js';
import {recordTimeoutDelays} from './helpers.js';

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
    const res = await retry(3, okFn, 5, 4);
    assert.strictEqual(res, 20);
    assert.strictEqual(okFnCalls, 1);
  });
  it('should retry a failing function and eventually throw the same err', async function () {
    await assert.rejects(retry(3, badFn), {message: 'bad'});
    assert.strictEqual(badFnCalls, 3);
  });
  it('should return the correct value with a function that eventually passes', async function () {
    await assert.rejects(retry(3, eventuallyOkFn, 4), {message: 'not ok yet'});
    assert.strictEqual(eventuallyOkFnCalls, 3);

    // rerun with ok number of calls
    eventuallyOkFnCalls = 0;
    const res = await retry(3, eventuallyOkFn, 3);
    assert.strictEqual(eventuallyOkFnCalls, 3);
    assert.strictEqual(res, 9);
  });
  describe('retryInterval', function () {
    it('should return the correct value with a function that eventually passes', async function (t) {
      const delays = recordTimeoutDelays(t);
      await assert.rejects(retryInterval(3, 15, eventuallyOkNoSleepFn, 4), {message: 'not ok yet'});
      assert.strictEqual(eventuallyOkFnCalls, 3);

      // rerun with ok number of calls
      eventuallyOkFnCalls = 0;
      const res = await retryInterval(3, 15, eventuallyOkNoSleepFn, 3);
      assert.strictEqual(eventuallyOkFnCalls, 3);
      assert.strictEqual(res, 9);
      // two pauses per run: after each failed attempt but the last
      assert.deepStrictEqual(
        delays.filter((ms) => ms === 15),
        [15, 15, 15, 15],
      );
    });
    it('should not wait on the final error', async function (t) {
      const delays = recordTimeoutDelays(t);
      await assert.rejects(retryInterval(3, 23, badFn), {message: 'bad'});
      assert.strictEqual(delays.filter((ms) => ms === 23).length, 2);
    });
  });
});
