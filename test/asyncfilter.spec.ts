import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {asyncfilter} from '../lib/asyncfilter.js';
import {sleep} from '../lib/sleep.js';
import {createConcurrencyTracker} from './helpers.js';

describe('asyncfilter', function () {
  const coll = [1, 2, 3, 4, 5];
  const expected = [2, 4];
  const makeFn = () => {
    const tracker = createConcurrencyTracker();
    const fn = tracker.wrap(async (el: number): Promise<boolean> => {
      await sleep(10);
      return el % 2 === 0;
    });
    return {tracker, fn};
  };
  it('should filter elements one at a time', async function () {
    const {tracker, fn} = makeFn();
    assert.deepStrictEqual(await asyncfilter(coll, fn, false), expected);
    assert.strictEqual(tracker.max, 1);
  });
  it('should filter elements in parallel', async function () {
    const {tracker, fn} = makeFn();
    assert.deepStrictEqual(await asyncfilter(coll, fn), expected);
    assert.strictEqual(tracker.max, coll.length);
  });
  it('should filter elements with concurrency', async function () {
    const {tracker, fn} = makeFn();
    assert.deepStrictEqual(await asyncfilter(coll, fn, {concurrency: 2}), expected);
    assert.strictEqual(tracker.max, 2);
  });
  it('should handle an empty array', async function () {
    assert.deepStrictEqual(await asyncfilter([], makeFn().fn, false), []);
  });
  it('should handle an empty array in parallel', async function () {
    assert.deepStrictEqual(await asyncfilter([], makeFn().fn), []);
  });
  it('should work for a sync filter function', async function () {
    const syncFn = (el: number): boolean => el % 2 === 0;
    assert.deepStrictEqual(await asyncfilter(coll, syncFn, false), expected);
    assert.deepStrictEqual(await asyncfilter(coll, syncFn), expected);
  });
  it('should skip holes in sparse arrays when filtering serially', async function () {
    const seen: number[] = [];
    // eslint-disable-next-line no-sparse-arrays
    const sparse = [1, , 2, , 4] as number[];
    const result = await asyncfilter(
      sparse,
      async (el: number) => {
        seen.push(el);
        return el % 2 === 0;
      },
      false,
    );
    assert.deepStrictEqual(result, [2, 4]);
    assert.deepStrictEqual(seen, [1, 2, 4]);
  });
  it('should raise an error if options is null', async function () {
    await assert.rejects(() => asyncfilter(coll, makeFn().fn, null as any), /Options cannot be null/);
  });
});
