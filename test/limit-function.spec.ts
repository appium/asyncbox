import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {limitFunction} from '../lib/collections/limit-function.js';
import {sleep} from '../lib/time/sleep.js';
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
  it('should not exceed the limit when a new call races a released slot', async function () {
    const tracker = createConcurrencyTracker();
    const fn = limitFunction(
      tracker.wrap(async () => {
        await Promise.resolve();
        await Promise.resolve();
      }),
      {concurrency: 1},
    );
    const calls = [fn(), fn()];
    let chain = Promise.resolve();
    for (let i = 0; i < 6; i++) {
      chain = chain.then(() => {
        calls.push(fn());
      });
    }
    await chain;
    await Promise.all(calls);
    assert.strictEqual(tracker.max, 1);
  });
  it('should start queued calls in FIFO order', async function () {
    const order: number[] = [];
    const fn = limitFunction(
      async (n: number) => {
        order.push(n);
        await sleep(1);
      },
      {concurrency: 1},
    );
    await Promise.all([1, 2, 3, 4].map(fn));
    assert.deepStrictEqual(order, [1, 2, 3, 4]);
  });
  it('should allow Infinity concurrency', async function () {
    const tracker = createConcurrencyTracker();
    const fn = limitFunction(
      tracker.wrap(async () => sleep(5)),
      {concurrency: Infinity},
    );
    await Promise.all([1, 2, 3].map(() => fn()));
    assert.strictEqual(tracker.max, 3);
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
