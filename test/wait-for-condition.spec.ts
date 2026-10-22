import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {waitForCondition} from '../lib/wait-for-condition.js';
import {recordTimeoutDelays} from './helpers.js';

describe('waitForCondition', function () {
  it('should wait and succeed', async function (t) {
    const delays = recordTimeoutDelays(t);
    let calls = 0;
    const result = await waitForCondition(() => ++calls >= 5 && 'done', {waitMs: 5000, intervalMs: 10});
    assert.strictEqual(result, 'done');
    assert.strictEqual(calls, 5);
    assert.deepStrictEqual(
      delays.filter((ms) => ms <= 10),
      [10, 10, 10, 10],
    );
  });
  it('should wait and fail', async function () {
    await assert.rejects(
      waitForCondition(() => false, {waitMs: 50, intervalMs: 10}),
      /Condition unmet/,
    );
  });
  it('should throw the provided error message or instance', async function () {
    await assert.rejects(
      waitForCondition(() => false, {waitMs: 20, intervalMs: 10, error: 'custom'}),
      {
        message: 'custom',
      },
    );
    const error = new RangeError('instance');
    await assert.rejects(
      waitForCondition(() => false, {waitMs: 20, intervalMs: 10, error}),
      error,
    );
  });
  it('should reduce interval to not exceed timeout', async function (t) {
    const delays = recordTimeoutDelays(t);
    await assert.rejects(
      waitForCondition(() => false, {waitMs: 60, intervalMs: 50}),
      /Condition unmet/,
    );
    const sleeps = delays.filter((ms) => ms <= 50);
    assert.strictEqual(sleeps[0], 50);
    // only the time left is slept on the next spin
    assert.ok(sleeps[1] < 50);
  });
});
