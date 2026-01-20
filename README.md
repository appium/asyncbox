asyncbox
========

A collection of ES7 async/await utilities. Install via NPM:

```
npm install asyncbox
```

Then, behold!

### Sleep

An async/await version of setTimeout

```js
import { sleep } from 'asyncbox';

async function myFn () {
    // do some stuff
    await sleep(1000); // wait one second
    // do some other stuff
};
```

### Long Sleep

Sometimes `Promise.delay` or `setTimeout` are inaccurate for large wait times. To safely wait for these long times (e.g. in the 5+ minute range), you can use `longSleep`:

```js
import { longSleep } from 'asyncbox';

async function myFn () {
  await longSleep(10 * 60 * 1000); // wait for 10 mins
  await longSleep(5000, {thresholdMs: 10000}); // wait for 5s. Anything below the thresholdMs will use a single sleep
  await longSleep(5000, {intervalMs: 500}); // check the clock every 500ms to see if waiting should stop
}
```

You can also pass a `progressCb` option which is a callback function that receives an object with the properties `elapsedMs`, `timeLeft`, and `progress`. This will be called on every wait interval so you can do your wait logging or whatever.

```js
function progressCb({elapsedMs, timeLeft, progress}) {
  console.log(`We are {progress * 100}% complete waiting`);
}
await longSleep(10 * 60 * 1000, {progressCb});
```

### Retry

An async/await way of running a method until it doesn't throw an error

```js
import { sleep, retry } from 'asyncbox';

async function flakeyFunction (val1, val2) {
    if (val1 < 10) {
        throw new Error("this is a flakey value");
    }
    await sleep(1000);
    return val1 + val2;
}

async function myFn () {
    let randVals = [Math.random() * 100, Math.random() * 100];

    // run flakeyFunction up to 3 times until it succeeds.
    // if it doesn't, we'll get the error thrown in this context
    let randSum = await retry(3, flakeyFunction, ...randVals);
}
```

You can also use `retryInterval` to add a sleep in between retries. This can be
useful if you want to throttle how fast we retry:

```js
await retryInterval(3, 1500, expensiveFunction, ...args);
```

### Filter/Map

Filter and map are pretty handy concepts, and now you can write filter and map
functions that execute asynchronously!

```js
import { asyncmap, asyncfilter } from 'asyncbox';
```

Then in your async functions, you can do:

```js
const items = [1, 2, 3, 4];
const slowSquare = async (n) => { await sleep(5); return n * 2; };
let newItems = await asyncmap(items, async (i) => { return await slowSquare(i); });
console.log(newItems);  // [1, 4, 9, 16];

const slowEven = async (n) => { await sleep(5); return n % 2 === 0; };
newItems = await asyncfilter(items, async (i) => { return await slowEven(i); });
console.log(newItems); // [2, 4];
```

By default, `asyncmap` and `asyncfilter` run their operations in parallel; you
can pass `false` as a third argument to make sure it happens serially.

### Nodeify

Export async functions (Promises) and import this with your ES5 code to use it
with Node.

```js
var asyncbox = require('asyncbox')
  , sleep = asyncbox.sleep
  , nodeify = asyncbox.nodeify;

nodeify(sleep(1000), function (err, timer) {
  console.log(err); // null
  console.log(timer); // timer obj
});
```

### nodeifyAll

If you have a whole library you want to export nodeified versions of, it's pretty easy:

```js
import { nodeifyAll } from 'asyncbox';

async function foo () { ... }
async function bar () { ... }
let cb = nodeifyAll({foo, bar});
export { foo, bar, cb };
```

Then in my ES5 script I can do:

```js
var myLib = require('mylib').cb;

myLib.foo(function (err) { ... });
myLib.bar(function (err) { ... });
```

### waitForCondition

Takes a condition (a function returning a boolean or boolean promise),
and waits until the condition is true.

Throws a `/Condition unmet/` error if the condition has not been
satisfied within the allocated time, unless an error is provided in
the options, as the `error` property, which is either thrown itself, or
used as the message.

The condition result is returned if it is not falsy. If the condition
throws an error then this exception will be immediately passed through.

The default options are: `{ waitMs: 5000, intervalMs: 500 }`

```js
// define your own condition
function condFn () { return Math.random()*1000 > 995; }

// with default params
await waitForCondition(condFn);

// with options
await waitForCondition(condFn, {
  waitMs: 300000,
  intervalMs: 10000
});

// pass a logger to get extra debug info
await waitForCondition(condFn, {
  waitMs: 300000,
  intervalMs: 10000
  logger: myLogger // expects a debug method
});

// pass an error string to get that message in the resulting exception
try {
  await waitForCondition(condFn, {
    error: 'Unable to satisfy condition'
  });
} catch (err) {
  // err.message === 'Unable to satisfy condition'
}

// pass an error instance to be thrown
const error = new Error('Unable to satisfy condition');
try {
  await waitForCondition(condFn, {
    error: error
  });
} catch (err) {
  // err === error
}
```

### Run the tests

```
npm test
```
