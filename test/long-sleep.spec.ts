import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {longSleep} from '../lib/long-sleep.js';
import {recordTimeoutDelays} from './helpers.js';

describe('longSleep', function () {
  it('should work like sleep in general', async function (t) {
    const delays = recordTimeoutDelays(t);
    await longSleep(20);
    assert.deepStrictEqual(delays, [20]);
  });
  it('should work like sleep with values less than threshold', async function (t) {
    const delays = recordTimeoutDelays(t);
    await longSleep(20, {thresholdMs: 100});
    assert.deepStrictEqual(delays, [20]);
  });
  it('should work like sleep with values above threshold, but quantized', async function (t) {
    const delays = recordTimeoutDelays(t);
    await longSleep(50, {thresholdMs: 20, intervalMs: 40});
    assert.deepStrictEqual(delays, [40, 40]);
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
    await longSleep(500, {thresholdMs: 1, intervalMs: 100, progressCb});
    assert.ok(callCount > 3);
    assert.ok(curProgress >= 1);
    assert.ok(curTimeLeft <= 0);
    assert.ok(curElapsed >= 50);
  });
});
