import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import * as asyncbox from '../lib/index.js';

describe('public API', function () {
  it('should export exactly the documented runtime members', function () {
    assert.deepStrictEqual(Object.keys(asyncbox).sort(), [
      'AsyncLock',
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
});
