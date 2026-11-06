import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import * as asyncbox from '../lib/index.js';

describe('public API', function () {
  it('should export exactly the documented runtime members', function () {
    assert.deepStrictEqual(Object.keys(asyncbox).sort(), [
      'AsyncLock',
      'AsyncboxError',
      'ConditionUnmetError',
      'LockQueueFullError',
      'LockTimeoutError',
      'PromiseCancellationError',
      'TimeoutError',
      'asyncfilter',
      'asyncmap',
      'longSleep',
      'retry',
      'retryInterval',
      'sleep',
      'waitForCondition',
      'withTimeout',
    ]);
  });
  it('should export error classes that extend Error', function () {
    assert.ok(new asyncbox.TimeoutError() instanceof Error);
    assert.ok(new asyncbox.PromiseCancellationError() instanceof Error);
  });
  it('should expose a code and a common base class on all package errors', function () {
    const errors = [
      new asyncbox.TimeoutError(),
      new asyncbox.ConditionUnmetError(),
      new asyncbox.LockTimeoutError(),
      new asyncbox.LockQueueFullError(),
      new asyncbox.PromiseCancellationError(),
    ];
    for (const e of errors) {
      assert.ok(e instanceof asyncbox.AsyncboxError);
      assert.match(e.code, /^ERR_ASYNCBOX_/);
      assert.strictEqual(e.name, e.constructor.name);
    }
  });
});
