import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {asyncmap} from '../lib/collections/asyncmap.js';
import {sleep} from '../lib/time/sleep.js';
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
  it('should skip holes in sparse arrays when mapping serially', async function () {
    const seen: number[] = [];
    const sparse: number[] = [1, 2, 3];
    Reflect.deleteProperty(sparse, 1);
    const result = await asyncmap(
      sparse,
      async (el: number) => {
        seen.push(el);
        return el * 2;
      },
      false,
    );
    assert.deepStrictEqual(result, [2, 6]);
    assert.deepStrictEqual(seen, [1, 3]);
  });
  it('should snapshot elements up front when collection mutates during serial mapping', async function () {
    const mutating = [1, 2, 3, 4];
    const result = await asyncmap(
      mutating,
      async (el: number) => {
        await sleep(5);
        if (el === 1) {
          mutating.push(5);
          mutating[1] = 20;
          Reflect.deleteProperty(mutating, 2);
        }
        return el * 2;
      },
      false,
    );
    assert.deepStrictEqual(result, [2, 4, 6, 8]);
  });
  it('should raise an error if options is null', async function () {
    await assert.rejects(() => asyncmap(coll, makeFn().fn, null as any), /Options cannot be null/);
  });
});
