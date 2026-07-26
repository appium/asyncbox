const assert = require('node:assert/strict');
const {test} = require('node:test');
// Requires the package by name (rather than a build path) so this exercises the same
// "exports"/"main" resolution real CommonJS consumers go through.
const asyncbox = require('asyncbox');

test('require() interop with the CJS build', async () => {
  assert.equal(typeof asyncbox.sleep, 'function');
  assert.equal(typeof asyncbox.retry, 'function');
  await asyncbox.sleep(1);
});
