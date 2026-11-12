import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {limitFunction} from '../lib/limit-function.js';
import {sleep} from '../lib/sleep.js';
import {createConcurrencyTracker} from './helpers.js';

describe('limitFunction', function () {
  it('should cap concurrent calls and keep results in call order', async function () {
    const tracker = createConcurrencyTracker();
    const fn = limitFunction(
      tracker.wrap(async (n: number) => {
        await sleep(5);
        return n;
      }),
      {concurrency: 2},
    );
    assert.deepStrictEqual(await Promise.all([1, 2, 3, 4, 5].map(fn)), [1, 2, 3, 4, 5]);
    assert.strictEqual(tracker.max, 2);
  });
  it('should free the slot when a call rejects', async function () {
    const fn = limitFunction(
      async (n: number) => {
        if (n === 1) {
          throw new Error('boom');
        }
        return n;
      },
      {concurrency: 1},
    );
    const results = await Promise.allSettled([fn(1), fn(2)]);
    assert.strictEqual(results[0].status, 'rejected');
    assert.deepStrictEqual(results[1], {status: 'fulfilled', value: 2});
  });
  it('should reject invalid concurrency values', function () {
    for (const concurrency of [0, -1, 1.5, NaN]) {
      assert.throws(() => limitFunction(async () => 1, {concurrency}), TypeError);
    }
  });
});
