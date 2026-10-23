import {PromiseCancellationError} from './errors.js';
import type {CancellablePromise, SleepArg, SleepOptions} from './types.js';

/**
 * An async/await version of `setTimeout`. The returned promise has a `cancel()` method that clears
 * the timer and usually rejects with {@link PromiseCancellationError} unless you use the object form with
 * `cancelError: null` to resolve on cancel.
 *
 * @param ms - Milliseconds to wait
 * @returns A thenable you can `await`; call `.cancel()` to abort early.
 */
export function sleep(ms: number): CancellablePromise<void>;
/**
 * Object form: `ms` plus optional `cancelError` (non-empty string or `Error`, `null` to resolve on
 * cancel, or omitted / `undefined` / `''` for default {@link PromiseCancellationError}). Any non-array
 * object with a finite `ms` is accepted at runtime (including class instances), matching structural typing.
 *
 * @param options - Duration and optional cancellation behavior
 * @returns A thenable you can `await`; call `.cancel()` to abort early.
 */
export function sleep(options: SleepOptions): CancellablePromise<void>;
export function sleep(arg: SleepArg): CancellablePromise<void> {
  const {ms, cancelError} = parseSleepArg(arg);
  let timeoutId: NodeJS.Timeout | undefined;
  let resolveFn: ((value: void) => void) | undefined;
  let rejectFn: ((error: Error) => void) | undefined;

  const promise = new Promise<void>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
    timeoutId = setTimeout(resolve, ms);
  }) as CancellablePromise<void>;

  promise.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    if (cancelError === null) {
      resolveFn?.(undefined);
    } else {
      let err: Error;
      if (typeof cancelError === 'string' && cancelError) {
        err = new PromiseCancellationError(cancelError);
      } else if (cancelError instanceof Error) {
        err = cancelError;
      } else {
        err = new PromiseCancellationError();
      }
      rejectFn?.(err);
    }
    resolveFn = undefined;
    rejectFn = undefined;
  };

  return promise;
}

/** Non-array object values (including class instances); excludes `null` and arrays. */
function isSleepArgObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseSleepArg(arg: SleepArg): {ms: number; cancelError?: string | Error | null} {
  if (typeof arg === 'number') {
    if (!Number.isFinite(arg)) {
      throw new TypeError('sleep: expected a finite number or an object with ms');
    }
    return {ms: arg};
  }
  if (isSleepArgObject(arg)) {
    const ms = arg.ms;
    if (typeof ms !== 'number' || !Number.isFinite(ms)) {
      throw new TypeError('sleep: options.ms must be a finite number');
    }
    return {ms, cancelError: arg.cancelError as string | Error | null | undefined};
  }
  throw new TypeError('sleep: expected a finite number or an object with ms');
}
