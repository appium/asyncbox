import {TimeoutError} from './errors.js';

/**
 * Resolves with `promise` or rejects if it does not settle before `timeoutMs`.
 *
 * If the deadline passes first: with no third argument (or a falsy non-error value), rejects
 * with {@link TimeoutError} whose message includes `timeoutMs`; with a non-empty string,
 * rejects with {@link TimeoutError} using that message; with an `Error` instance, rejects
 * with that same instance.
 *
 * @param promise - Promise to race against the timeout.
 * @param timeoutMs - Maximum time in milliseconds before rejecting if `promise` has not settled.
 * @param messageOrError - Optional override for the timeout rejection: custom {@link TimeoutError}
 * message when the string is non-empty, or an existing `Error` to reject with verbatim.
 * Omitted, `undefined`, or other falsy non-error values use the default timeout message (includes `timeoutMs`).
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  messageOrError?: string | Error,
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          if (typeof messageOrError === 'string' && messageOrError) {
            reject(new TimeoutError(messageOrError));
          } else if (!messageOrError) {
            reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
          } else {
            reject(messageOrError);
          }
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
