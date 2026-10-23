import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {describe, it} from 'node:test';

import {AsyncLock} from '../lib/lock.js';
import {sleep} from '../lib/sleep.js';

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

describe('AsyncLock', function () {
  it('should return the task result', async function () {
    const lock = new AsyncLock();
    assert.equal(await lock.acquire('k', () => 1), 1);
    assert.equal(await lock.acquire('k', async () => 'a'), 'a');
  });

  it('should start a task synchronously if the lock is free', function () {
    const lock = new AsyncLock();
    let ran = false;
    const p = lock.acquire('k', () => {
      ran = true;
    });
    assert.ok(ran);
    assert.ok(lock.isBusy('k'));
    return p;
  });

  it('should run tasks with the same key one at a time in FIFO order', async function () {
    const lock = new AsyncLock();
    const log: string[] = [];
    const task = (name: string, ms: number) => async () => {
      log.push(`${name}:start`);
      await sleep(ms);
      log.push(`${name}:end`);
    };
    await Promise.all([
      lock.acquire('k', task('a', 20)),
      lock.acquire('k', task('b', 1)),
      lock.acquire('k', task('c', 1)),
    ]);
    assert.deepEqual(log, ['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  it('should run tasks with different keys concurrently', async function () {
    const lock = new AsyncLock();
    const gate = deferred();
    const started: string[] = [];
    const a = lock.acquire('a', async () => {
      started.push('a');
      await gate.promise;
    });
    const b = lock.acquire('b', async () => {
      started.push('b');
      await gate.promise;
    });
    assert.deepEqual(started, ['a', 'b']);
    gate.resolve();
    await Promise.all([a, b]);
  });

  it('should propagate sync throws and rejections and keep working', async function () {
    const lock = new AsyncLock();
    await assert.rejects(
      lock.acquire('k', () => {
        throw new Error('sync');
      }),
      /sync/,
    );
    await assert.rejects(
      lock.acquire('k', async () => Promise.reject(new Error('async'))),
      /async/,
    );
    assert.equal(await lock.acquire('k', () => 'ok'), 'ok');
    assert.ok(!lock.isBusy());
  });

  it('should throw if the task is not a function', function () {
    const lock = new AsyncLock();
    assert.throws(() => lock.acquire('k', 'nope' as any), TypeError);
    assert.ok(!lock.isBusy());
  });

  it('should throw if the key is neither a string nor a non-empty array of strings', function () {
    const lock = new AsyncLock();
    const sparse: string[] = [];
    sparse[0] = 'a';
    sparse[2] = 'b'; // leaves a hole at index 1
    for (const key of [undefined, null, 1, {}, ['valid', 123], [undefined], sparse, new Array(2)]) {
      assert.throws(() => lock.acquire(key as any, () => 1), TypeError);
    }
    assert.ok(!lock.isBusy());
  });

  it('should support keys that clash with Object.prototype members', async function () {
    const lock = new AsyncLock();
    for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      assert.equal(await lock.acquire(key, () => key), key);
    }
    assert.ok(!lock.isBusy());
  });

  describe('async context', function () {
    it('should run queued tasks in the context of their own caller', async function () {
      const als = new AsyncLocalStorage<string>();
      const lock = new AsyncLock();
      const gate = deferred();
      const first = als.run('first', () =>
        lock.acquire('k', async () => {
          await gate.promise;
          return als.getStore();
        }),
      );
      const second = als.run('second', () => lock.acquire('k', () => als.getStore()));
      const third = als.run('third', () => lock.acquire('k', async () => als.getStore()));
      gate.resolve();
      assert.deepEqual(await Promise.all([first, second, third]), ['first', 'second', 'third']);
    });

    it('should keep the context for every key of a batch acquire', async function () {
      const als = new AsyncLocalStorage<string>();
      const lock = new AsyncLock();
      const gate = deferred();
      const holder = als.run('holder', () =>
        lock.acquire('b', async () => {
          await gate.promise;
        }),
      );
      const waiter = als.run('waiter', () => lock.acquire(['a', 'b'], () => als.getStore()));
      gate.resolve();
      await holder;
      assert.equal(await waiter, 'waiter');
    });
  });

  describe('multiple keys', function () {
    it('should hold all the keys while the task runs', async function () {
      const lock = new AsyncLock();
      const gate = deferred();
      const p = lock.acquire(['a', 'b'], () => gate.promise);
      assert.ok(lock.isBusy('a'));
      assert.ok(lock.isBusy('b'));
      gate.resolve();
      await p;
      assert.ok(!lock.isBusy());
    });

    it('should wait for any of the keys', async function () {
      const lock = new AsyncLock();
      const gate = deferred();
      const log: string[] = [];
      const holder = lock.acquire('b', async () => {
        await gate.promise;
        log.push('holder');
      });
      const batch = lock.acquire(['a', 'b'], () => {
        log.push('batch');
      });
      await sleep(5);
      assert.deepEqual(log, []);
      gate.resolve();
      await Promise.all([holder, batch]);
      assert.deepEqual(log, ['holder', 'batch']);
    });

    it('should not deadlock overlapping calls that list the keys in opposite orders', async function () {
      const lock = new AsyncLock();
      const log: string[] = [];
      const task = (name: string) => async () => {
        log.push(name);
        await sleep(5);
      };
      // a deadlock would make `maxOccupationTime` reject the calls
      const opts = {maxOccupationTime: 2000};
      await Promise.all([
        lock.acquire(['a', 'b'], task('ab'), opts),
        lock.acquire(['b', 'a'], task('ba'), opts),
        lock.acquire(['a', 'b', 'c'], task('abc'), opts),
        lock.acquire(['c', 'b'], task('cb'), opts),
      ]);
      assert.deepEqual([...log].sort(), ['ab', 'abc', 'ba', 'cb']);
      assert.ok(!lock.isBusy());
    });

    it('should ignore duplicate keys instead of deadlocking', async function () {
      const lock = new AsyncLock();
      assert.equal(await lock.acquire(['a', 'a'], () => 1, {timeout: 50}), 1);
    });

    it('should throw for an empty key list instead of running the task without a lock', function () {
      const lock = new AsyncLock();
      assert.throws(() => lock.acquire([], () => 1), TypeError);
    });

    it('should claim a large batch of free keys without overflowing the stack', async function () {
      const lock = new AsyncLock();
      const keys = Array.from({length: 20_000}, (_, i) => `key${i}`);
      assert.equal(await lock.acquire(keys, () => 1), 1);
      assert.ok(!lock.isBusy());
    });

    it('should claim a large batch resumed after waiting for its first key', async function () {
      const lock = new AsyncLock();
      const keys = Array.from({length: 20_000}, (_, i) => `key${i}`);
      const gate = deferred();
      const holder = lock.acquire(keys[0], () => gate.promise);
      const batch = lock.acquire(keys, () => 1);
      gate.resolve();
      await holder;
      assert.equal(await batch, 1);
      assert.ok(!lock.isBusy());
    });

    it('should not mutate the passed array', async function () {
      const lock = new AsyncLock();
      const keys = ['a', 'b'];
      await lock.acquire(keys, () => {});
      assert.deepEqual(keys, ['a', 'b']);
    });
  });

  describe('options', function () {
    it('should run a skipQueue task before the already queued ones', async function () {
      const lock = new AsyncLock();
      const gate = deferred();
      const log: string[] = [];
      const ps = [
        lock.acquire('k', () => gate.promise),
        lock.acquire('k', () => void log.push('queued')),
        lock.acquire('k', () => void log.push('priority'), {skipQueue: true}),
      ];
      gate.resolve();
      await Promise.all(ps);
      assert.deepEqual(log, ['priority', 'queued']);
    });

    it('should reject when too many tasks are pending', async function () {
      const lock = new AsyncLock({maxPending: 1});
      const gate = deferred();
      const running = lock.acquire('k', () => gate.promise);
      const pending = lock.acquire('k', () => 'pending');
      await assert.rejects(
        lock.acquire('k', () => 'extra'),
        /Too many pending tasks in queue k/,
      );
      gate.resolve();
      await running;
      assert.equal(await pending, 'pending');
    });

    it('should allow no pending tasks with maxPending 0 (per call too)', async function () {
      const lock = new AsyncLock();
      const gate = deferred();
      const running = lock.acquire('k', () => gate.promise);
      await assert.rejects(
        lock.acquire('k', () => 1, {maxPending: 0}),
        /Too many pending/,
      );
      gate.resolve();
      await running;
    });

    it('should use 1000 as the default maxPending', async function () {
      const lock = new AsyncLock();
      const gate = deferred();
      const ps = [lock.acquire('k', () => gate.promise)];
      for (let i = 0; i < 1000; i++) {
        ps.push(lock.acquire('k', () => {}));
      }
      await assert.rejects(
        lock.acquire('k', () => {}),
        /Too many pending/,
      );
      gate.resolve();
      await Promise.all(ps);
    });

    it('should time out a task waiting in the queue and drop it from the queue', async function () {
      const lock = new AsyncLock({maxPending: 1});
      const gate = deferred();
      let ran = false;
      const running = lock.acquire('k', () => gate.promise);
      await assert.rejects(
        lock.acquire('k', () => void (ran = true), {timeout: 10}),
        /timed out in queue k/,
      );
      // the timed out task no longer occupies the single pending slot
      const next = lock.acquire('k', () => 'next');
      gate.resolve();
      await running;
      assert.equal(await next, 'next');
      assert.ok(!ran);
    });

    it('should not time out a task that got the lock in time', async function () {
      const lock = new AsyncLock({timeout: 50});
      const first = lock.acquire('k', () => {});
      const second = lock.acquire('k', async () => {
        await sleep(120); // longer than the queue timeout
        return 'done';
      });
      await first;
      assert.equal(await second, 'done');
    });

    it('should fail on maxOccupationTime, also while still queued', async function () {
      const lock = new AsyncLock({maxOccupationTime: 20});
      const gate = deferred();
      let ran = false;
      const running = lock.acquire('k', () => gate.promise, {maxOccupationTime: 0});
      await assert.rejects(
        lock.acquire('k', () => void (ran = true)),
        /Maximum occupation time is exceeded in queue k/,
      );
      gate.resolve();
      await running;
      assert.ok(!ran);
      assert.ok(!lock.isBusy());
    });

    it('should share one maxOccupationTime budget across all keys of a batch', async function () {
      const lock = new AsyncLock();
      const gateA = deferred();
      const gateB = deferred();
      let ran = false;
      const holderA = lock.acquire('a', () => gateA.promise);
      const holderB = lock.acquire('b', () => gateB.promise);
      const batch = lock.acquire(['a', 'b'], () => void (ran = true), {maxOccupationTime: 200});
      await sleep(100);
      gateA.resolve(); // the batch gets 'a' with about half of its budget left and queues on 'b'
      await holderA;
      await assert.rejects(batch, /Maximum occupation time is exceeded/);
      // the nested 'b' waiter must expire with the batch instead of getting a fresh budget
      await sleep(50);
      assert.equal(lock.getQueueLength('b'), 0);
      gateB.resolve();
      await holderB;
      assert.ok(!ran);
      assert.ok(!lock.isBusy());
    });

    it('should apply maxExecutionTime of a batch to the task only and release all keys', async function () {
      const lock = new AsyncLock();
      const holderGate = deferred();
      const taskGate = deferred();
      let ran = false;
      let settled = false;
      const holder = lock.acquire('b', () => holderGate.promise);
      const batch = lock.acquire(
        ['a', 'b'],
        () => {
          ran = true;
          return taskGate.promise;
        },
        {maxExecutionTime: 20},
      );
      batch.then(
        () => (settled = true),
        () => (settled = true),
      );
      await sleep(60); // waiting for 'b' is not execution, so 'a' stays held and nothing times out
      assert.ok(!ran);
      assert.ok(!settled);
      assert.ok(lock.isBusy('a'));
      holderGate.resolve();
      await holder;
      await assert.rejects(batch, /Maximum execution time is exceeded/);
      assert.ok(ran);
      assert.ok(!lock.isBusy());
      taskGate.resolve();
    });

    it('should release all keys of a batch before starting a waiter', async function () {
      for (const [waitedKey, otherKey] of [
        ['a', 'b'],
        ['b', 'a'],
      ]) {
        const lock = new AsyncLock();
        const taskGate = deferred();
        const batch = lock.acquire(['a', 'b'], () => taskGate.promise, {maxExecutionTime: 10});
        const otherKeyBusy = lock.acquire(waitedKey, () => lock.isBusy(otherKey));
        await assert.rejects(batch, /Maximum execution time/);
        assert.equal(await otherKeyBusy, false, `'${otherKey}' was still held when a waiter of '${waitedKey}' started`);
        taskGate.resolve();
      }
    });

    it('should keep the lock after maxOccupationTime until the task finishes', async function () {
      const lock = new AsyncLock();
      const gate = deferred();
      const log: string[] = [];
      const slow = lock.acquire(
        'k',
        async () => {
          await gate.promise;
          log.push('slow');
        },
        {maxOccupationTime: 10},
      );
      const next = lock.acquire('k', () => void log.push('next'));
      await assert.rejects(slow, /Maximum occupation time is exceeded while executing k/);
      assert.deepEqual(log, []);
      gate.resolve();
      await next;
      assert.deepEqual(log, ['slow', 'next']);
    });

    it('should release the lock exactly once on maxExecutionTime', async function () {
      const lock = new AsyncLock({maxExecutionTime: 10});
      const gate = deferred();
      const secondDone = deferred();
      let active = 0;
      let maxActive = 0;
      const track = (fn: () => Promise<void>) => async () => {
        maxActive = Math.max(maxActive, ++active);
        try {
          await fn();
        } finally {
          active--;
        }
      };
      const opts = {maxExecutionTime: 0};
      const stuck = lock.acquire('k', () => gate.promise);
      const second = lock.acquire(
        'k',
        track(() => secondDone.promise),
        opts,
      );
      const third = lock.acquire(
        'k',
        track(async () => {}),
        opts,
      );
      await assert.rejects(stuck, /Maximum execution time is exceeded k/);
      // the stuck task finishing late must not release the lock held by `second`
      gate.resolve();
      await sleep(30);
      assert.equal(active, 1, 'only `second` is running');
      secondDone.resolve();
      await Promise.all([second, third]);
      assert.equal(maxActive, 1);
      assert.ok(!lock.isBusy());
    });

    it('should apply timeout to the whole wait for all the keys of a batch', async function () {
      const lock = new AsyncLock();
      const gateA = deferred();
      const gateB = deferred();
      const holderA = lock.acquire('a', () => gateA.promise);
      const holderB = lock.acquire('b', () => gateB.promise);
      const batch = lock.acquire(['a', 'b'], () => 'done', {timeout: 200});
      const outcome = batch.then(
        () => 'acquired',
        (e: Error) => e.message,
      );
      await sleep(100);
      gateA.resolve(); // the batch holds 'a' now and waits for 'b' with about half of its budget left
      await holderA;
      await sleep(180); // 'b' is released after the whole budget (200) but before a fresh one (100 + 200)
      gateB.resolve();
      await holderB;
      assert.match(await outcome, /timed out in queue b/);
      assert.ok(!lock.isBusy());
    });

    it('should let per-call options override the constructor ones', async function () {
      const lock = new AsyncLock({timeout: 5});
      const gate = deferred();
      const running = lock.acquire('k', () => gate.promise);
      const waiting = lock.acquire('k', () => 'ok', {timeout: 0});
      await sleep(20);
      gate.resolve();
      await running;
      assert.equal(await waiting, 'ok');
    });

    it('should validate options', function () {
      assert.throws(() => new AsyncLock(null as any), TypeError);
      assert.throws(() => new AsyncLock({timeout: -1}), TypeError);
      assert.throws(() => new AsyncLock({maxOccupationTime: 3e9}), TypeError);
      assert.throws(() => new AsyncLock({maxPending: 1.5}), TypeError);
      assert.throws(() => new AsyncLock({maxExecutionTime: NaN}), TypeError);
      assert.doesNotThrow(() => new AsyncLock({maxPending: Infinity}));
    });

    it('should throw on invalid per-call options', function () {
      const lock = new AsyncLock();
      assert.throws(() => lock.acquire('k', () => 1, {timeout: -1}), TypeError);
      assert.throws(() => lock.acquire('k', () => 1, {timeout: 2 ** 31}), TypeError); // would fire at once
      assert.throws(() => lock.acquire('k', () => 1, null as any), TypeError);
      assert.throws(() => lock.acquire('k', () => 1, {skipQueue: 'yes' as any}), TypeError);
      assert.ok(!lock.isBusy());
    });
  });

  describe('handover', function () {
    it('should pass the key on if the waiter is aborted while the key is being handed over', async function (t) {
      t.mock.timers.enable({apis: ['setTimeout']});
      const lock = new AsyncLock();
      const gate = deferred();
      let victimRan = false;
      // releases 'b' first, then 'a'; the waiter on 'b' runs first and expires the waiter on 'a'
      const holder = lock.acquire(['a', 'b'], () => gate.promise);
      const trigger = lock.acquire('b', () => t.mock.timers.tick(100));
      const victim = lock.acquire('a', () => void (victimRan = true), {timeout: 50});
      const victimOutcome = assert.rejects(victim, /timed out in queue a/);
      gate.resolve();
      await Promise.all([holder, trigger, victimOutcome]);
      await Promise.resolve();
      assert.ok(!victimRan, 'an expired waiter must not run its task');
      assert.ok(!lock.isBusy(), 'the key must not stay held');
      assert.equal(await lock.acquire('a', () => 'free'), 'free');
    });
  });

  describe('getQueueLength', function () {
    it('should count waiting tasks, not the running one', async function () {
      const lock = new AsyncLock();
      assert.equal(lock.getQueueLength('k'), 0);
      const gate = deferred();
      const ps = [lock.acquire('k', () => gate.promise)];
      assert.equal(lock.getQueueLength('k'), 0);
      ps.push(
        lock.acquire('k', () => {}),
        lock.acquire('k', () => {}),
      );
      assert.equal(lock.getQueueLength('k'), 2);
      assert.equal(lock.getQueueLength('other'), 0);
      gate.resolve();
      await Promise.all(ps);
      assert.equal(lock.getQueueLength('k'), 0);
    });

    it('should not count tasks that timed out in the queue', async function () {
      const lock = new AsyncLock();
      const gate = deferred();
      const running = lock.acquire('k', () => gate.promise);
      const waiting = lock.acquire('k', () => {}, {timeout: 10});
      assert.equal(lock.getQueueLength('k'), 1);
      await assert.rejects(waiting, /timed out/);
      assert.equal(lock.getQueueLength('k'), 0);
      gate.resolve();
      await running;
    });
  });

  describe('isBusy', function () {
    it('should report running and pending keys', async function () {
      const lock = new AsyncLock();
      assert.ok(!lock.isBusy());
      assert.ok(!lock.isBusy('k'));
      const gate = deferred();
      const p = lock.acquire('k', () => gate.promise);
      assert.ok(lock.isBusy());
      assert.ok(lock.isBusy('k'));
      assert.ok(!lock.isBusy('other'));
      gate.resolve();
      await p;
      assert.ok(!lock.isBusy());
    });
  });
});
