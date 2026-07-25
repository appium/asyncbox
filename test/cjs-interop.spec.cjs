const assert = require('node:assert/strict');
const {test} = require('node:test');
const asyncbox = require('../build/cjs/lib/asyncbox.js');

test('require() interop with the CJS build', async () => {
  assert.equal(typeof asyncbox.sleep, 'function');
  assert.equal(typeof asyncbox.retry, 'function');
  await asyncbox.sleep(1);
});
