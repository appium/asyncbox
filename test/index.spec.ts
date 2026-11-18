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
  it('should expose a static code matching the instance code', function () {
    for (const cls of [
      asyncbox.TimeoutError,
      asyncbox.ConditionUnmetError,
      asyncbox.LockTimeoutError,
      asyncbox.LockQueueFullError,
      asyncbox.PromiseCancellationError,
    ]) {
      assert.match(cls.code, /^ERR_ASYNCBOX_/);
      assert.strictEqual(new cls().code, cls.code);
    }
  });
  describe('AsyncboxError.is', function () {
    it('should match instances of the class and of its subclasses', function () {
      assert.ok(asyncbox.ConditionUnmetError.is(new asyncbox.ConditionUnmetError()));
      assert.ok(asyncbox.TimeoutError.is(new asyncbox.ConditionUnmetError()));
      assert.ok(asyncbox.AsyncboxError.is(new asyncbox.LockQueueFullError()));
    });
    it('should match an error of another copy of the package by code', function () {
      const foreign = Object.assign(new Error('custom'), {code: asyncbox.ConditionUnmetError.code});
      assert.ok(asyncbox.ConditionUnmetError.is(foreign));
      assert.ok(!asyncbox.TimeoutError.is(foreign));
    });
    it('should not match other errors and non-errors', function () {
      assert.ok(!asyncbox.ConditionUnmetError.is(new asyncbox.TimeoutError()));
      assert.ok(!asyncbox.ConditionUnmetError.is(new Error('Condition unmet')));
      assert.ok(!asyncbox.ConditionUnmetError.is({code: asyncbox.ConditionUnmetError.code}));
      assert.ok(!asyncbox.ConditionUnmetError.is(undefined));
    });
  });
});
