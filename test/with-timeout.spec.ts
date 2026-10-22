import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {TimeoutError} from '../lib/errors.js';
import {sleep} from '../lib/sleep.js';
import {withTimeout} from '../lib/with-timeout.js';

describe('withTimeout', function () {
  function neverSettles<T>(): Promise<T> {
    return new Promise(() => {});
  }

  it('should resolve when the promise settles before the deadline', async function () {
    const result = await withTimeout(Promise.resolve(42), 1000);
    assert.strictEqual(result, 42);
  });
  it('should reject with TimeoutError when the deadline is exceeded', async function () {
    await assert.rejects(withTimeout(neverSettles<string>(), 30), TimeoutError);
  });
  it('should use the default TimeoutError message when none is provided', async function () {
    const timeoutMs = 20;
    try {
      await withTimeout(neverSettles<string>(), timeoutMs);
      assert.fail('expected rejection');
    } catch (err: unknown) {
      assert.ok(err instanceof TimeoutError);
      assert.strictEqual((err as TimeoutError).message, `Operation timed out after ${timeoutMs}ms`);
    }
  });
  it('should use a custom message on TimeoutError when provided', async function () {
    try {
      await withTimeout(neverSettles<string>(), 20, 'custom timeout');
      assert.fail('expected rejection');
    } catch (err: unknown) {
      assert.ok(err instanceof TimeoutError);
      assert.strictEqual((err as TimeoutError).message, 'custom timeout');
    }
  });
  it('should reject with a provided Error instance on timeout', async function () {
    class CustomTimeout extends Error {
      constructor(message?: string) {
        super(message ?? 'custom default');
        this.name = 'CustomTimeout';
      }
    }
    const customErr = new CustomTimeout('overridden');
    try {
      await withTimeout(neverSettles<string>(), 20, customErr);
      assert.fail('expected rejection');
    } catch (err: unknown) {
      assert.strictEqual(err, customErr);
      assert.ok(err instanceof CustomTimeout);
      assert.strictEqual((err as CustomTimeout).message, 'overridden');
    }
  });
  it('should propagate rejection from the underlying promise before the deadline', async function () {
    const failing = (async () => {
      await sleep(10);
      throw new Error('boom');
    })();
    await assert.rejects(withTimeout(failing, 1000), /boom/);
  });
});
