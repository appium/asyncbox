import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {asyncmap} from '../lib/asyncmap.js';
import {sleep} from '../lib/sleep.js';
import {createConcurrencyTracker} from './helpers.js';

describe('asyncmap', function () {
  const coll = [1, 2, 3, 4, 5];
  const expected = [2, 4, 6, 8, 10];
  const makeFn = () => {
    const tracker = createConcurrencyTracker();
    const fn = tracker.wrap(async (el: number): Promise<number> => {
      await sleep(10);
      return el * 2;
    });
    return {tracker, fn};
  };
  it('should map elements one at a time', async function () {
    const {tracker, fn} = makeFn();
    assert.deepStrictEqual(await asyncmap(coll, fn, false), expected);
    assert.strictEqual(tracker.max, 1);
  });
  it('should map elements in parallel', async function () {
    const {tracker, fn} = makeFn();
    assert.deepStrictEqual(await asyncmap(coll, fn), expected);
    assert.strictEqual(tracker.max, coll.length);
  });
  it('should map elements with concurrency', async function () {
    const {tracker, fn} = makeFn();
    assert.deepStrictEqual(await asyncmap(coll, fn, {concurrency: 2}), expected);
    assert.strictEqual(tracker.max, 2);
  });
  it('should handle an empty array', async function () {
    assert.deepStrictEqual(await asyncmap([], makeFn().fn, false), []);
  });
  it('should handle an empty array in parallel', async function () {
    assert.deepStrictEqual(await asyncmap([], makeFn().fn), []);
  });
  it('should work for a sync map function', async function () {
    const syncFn = (el: number): number => el * 2;
    assert.deepStrictEqual(await asyncmap(coll, syncFn, false), expected);
    assert.deepStrictEqual(await asyncmap(coll, syncFn), expected);
  });
  it('should raise an error if options is null', async function () {
    await assert.rejects(() => asyncmap(coll, makeFn().fn, null as any), /Options cannot be null/);
  });
});
