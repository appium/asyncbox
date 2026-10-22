asyncbox
========

A collection of ES7 async/await utilities. Install via NPM:

```
npm install asyncbox
```

Published as both ESM and CommonJS, so `import {sleep} from 'asyncbox'` and `const {sleep} = require('asyncbox')` both work.

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

### withTimeout

Race a promise against a deadline. If the promise settles first, its result is returned; if the deadline passes first, the call rejects. By default that rejection is a `TimeoutError` whose message includes how long you waited; you can pass a non-empty string for a custom `TimeoutError` message, or an `Error` instance to reject with that exact value. Omitted or other falsy third arguments (except a real `Error`) use the default timeout message.

`withTimeout` only stops *waiting* on the promise: the underlying async work keeps running (there is no built-in cancellation). Aborting a `fetch`, clearing timers, or tearing down other resources is the caller’s responsibility if you need that behavior.

```js
import { withTimeout, TimeoutError } from 'asyncbox';

// default: TimeoutError, message includes timeoutMs
await withTimeout(fetch('/slow').then((r) => r.json()), 5000);

// custom TimeoutError message
await withTimeout(slowWork(), 10_000, 'slowWork exceeded 10s');

// reject with a specific error you constructed (same object on timeout)
const err = new MyAppError('upstream did not respond');
await withTimeout(slowWork(), 5000, err);
```

Cancelling an in-flight `fetch` when the timeout wins:

```js
import { withTimeout, TimeoutError } from 'asyncbox';

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const body = fetch(url, { signal: controller.signal }).then((r) => r.json());
  try {
    return await withTimeout(body, timeoutMs);
  } catch (err) {
    if (err instanceof TimeoutError) {
      controller.abort();
    }
    throw err;
  }
}
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
const slowSquare = async (n) => { await sleep(5); return n * n; };
let newItems = await asyncmap(items, slowSquare);
console.log(newItems);  // [1, 4, 9, 16];

const slowEven = async (n) => { await sleep(5); return n % 2 === 0; };
newItems = await asyncfilter(items, slowEven);
console.log(newItems); // [2, 4];
```

By default, `asyncmap` and `asyncfilter` run their operations in parallel, but you
can set the third argument to `false` to enforce sequential execution, or set a custom
concurrency pool limit using `{concurrency: <number>}`:

```js
const items = [1, 2, 3, 4];
const slowSquare = async (n) => { await sleep(5); return n * n; };
// this will run sequentially (~20ms)
const newItemsSeq = await asyncmap(items, slowSquare, false);
// this will handle 2 items at a time (~10ms)
const newItemsMaxTwo = await asyncmap(items, slowSquare, {concurrency: 2});
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

### AsyncLock

A promise-based mutex keyed by string, derived from the unmaintained
[async-lock](https://github.com/rogierschouten/async-lock) (MIT). Tasks with the
same key run one at a time in FIFO order; different keys run concurrently.

Differences from `async-lock`: promises only (no callbacks, custom `Promise`
or domain support), and each task runs in the `AsyncLocalStorage` context of
its own `acquire` caller instead of the previous lock holder's one, so no
`AsyncResource.bind` is needed. A task that outlives `maxExecutionTime` can no
longer release the lock a second time, and queued tasks that time out are
removed from the queue.

```js
import {AsyncLock} from 'asyncbox';

const lock = new AsyncLock({maxPending: 10});

const result = await lock.acquire('key', async () => {
  // runs exclusively for 'key'
  return 42;
});

// several keys are held together; they are acquired in sorted order, so overlapping calls cannot deadlock
await lock.acquire(['key1', 'key2'], () => {});

// per-call options: timeout, maxOccupationTime, maxExecutionTime, maxPending, skipQueue
await lock.acquire('key', () => {}, {timeout: 5000, skipQueue: true});

lock.getQueueLength('key'); // tasks waiting for the key (the running one is not counted)
lock.isBusy('key'); // running or pending tasks for the key
lock.isBusy(); // any key
```

Options can be passed to the constructor and overridden per `acquire` call.
Times are in ms, up to 2147483647, and `0` means no limit.

- `timeout` (default `0`) - max wait in the queue (for all the keys of a multi-key call together) before the task is rejected and dropped
- `maxOccupationTime` (default `0`) - max time from `acquire` to completion, queue wait included; one budget is shared by all keys of a multi-key call
- `maxExecutionTime` (default `0`) - max time the task may run while holding the lock; the lock is released when exceeded (for a multi-key call, it counts from when all keys are held and releases all of them)
- `maxPending` (default `1000`) - max tasks waiting per key; further ones are rejected right away, so `0` rejects every task that would have to wait
- `skipQueue` (default `false`, per call only) - put the task at the front of the queue

### Run the tests

```
npm test
```
