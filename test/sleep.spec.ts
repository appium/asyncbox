import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {PromiseCancellationError} from '../lib/errors.js';
import {sleep} from '../lib/sleep.js';
import type {SleepOptions} from '../lib/types.js';
import {recordTimeoutDelays} from './helpers.js';

describe('sleep', function () {
  it('should work like setTimeout', async function (t) {
    const delays = recordTimeoutDelays(t);
    await sleep(20);
    assert.deepStrictEqual(delays, [20]);
  });
  it('should expose cancel on the promise', function () {
    const d = sleep(100);
    assert.ok(typeof d.cancel === 'function');
  });
  it('should reject with PromiseCancellationError when cancelled', async function () {
    const d = sleep(10_000);
    d.cancel();
    await assert.rejects(d, PromiseCancellationError);
  });
  it('should reject immediately on cancel without waiting for ms', async function () {
    const d = sleep(10_000);
    const start = performance.now();
    d.cancel();
    await assert.rejects(d, PromiseCancellationError);
    assert.ok(performance.now() - start < 5000);
  });
  it('should use default PromiseCancellationError when cancelError is empty string', async function () {
    const d = sleep({ms: 10_000, cancelError: ''});
    d.cancel();
    try {
      await d;
      assert.fail('expected rejection');
    } catch (err: unknown) {
      assert.ok(err instanceof PromiseCancellationError);
      assert.strictEqual((err as PromiseCancellationError).message, 'Promise cancelled');
    }
  });
  it('should reject with PromiseCancellationError using cancelError string when cancelled', async function () {
    const d = sleep({ms: 10_000, cancelError: 'aborted'});
    d.cancel();
    try {
      await d;
      assert.fail('expected rejection');
    } catch (err: unknown) {
      assert.ok(err instanceof PromiseCancellationError);
      assert.strictEqual((err as PromiseCancellationError).message, 'aborted');
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
      assert.fail('expected rejection');
    } catch (err: unknown) {
      assert.strictEqual(err, customErr);
      assert.ok(err instanceof CustomCancel);
      assert.strictEqual((err as CustomCancel).message, 'nope');
    }
  });
  it('should resolve when cancelled if cancelError is null', async function () {
    const d = sleep({ms: 10_000, cancelError: null});
    const start = performance.now();
    d.cancel();
    await d;
    assert.ok(performance.now() - start < 5000);
  });
  it('should throw TypeError when ms is not finite', function () {
    assert.throws(() => sleep(Number.NaN), /finite number or an object with ms/);
    assert.throws(() => sleep(Number.POSITIVE_INFINITY), /finite number or an object with ms/);
  });
  it('should throw TypeError when arg is not a number or object', function () {
    assert.throws(() => sleep(null as unknown as number), /finite number or an object with ms/);
    assert.throws(() => sleep([] as unknown as number), /finite number or an object with ms/);
  });
  it('should throw TypeError when object has invalid ms', function () {
    assert.throws(() => sleep({} as unknown as SleepOptions), /options\.ms must be a finite number/);
    assert.throws(() => sleep({ms: Number.NaN}), /options\.ms must be a finite number/);
  });
  it('should accept a null-prototype object with ms', async function (t) {
    const delays = recordTimeoutDelays(t);
    const o = Object.create(null) as {ms: number};
    o.ms = 20;
    await sleep(o);
    assert.deepStrictEqual(delays, [20]);
  });
  it('should accept a class instance that satisfies SleepOptions', async function (t) {
    class Opts implements SleepOptions {
      ms = 25;
    }
    const delays = recordTimeoutDelays(t);
    await sleep(new Opts());
    assert.deepStrictEqual(delays, [25]);
  });
});
