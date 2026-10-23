import {getLimitFunction} from './limit-function.js';
import type {MapFilterOptions} from './types.js';

/**
 * Similar to `Array.prototype.map`; runs in parallel, serial, or with custom concurrency pool
 * @param coll - The collection to map over
 * @param mapper - The function to apply to each element
 * @param options - Options for controlling parallelism (default: true - fully parallel)
 */
export async function asyncmap<T, R>(
  coll: T[],
  mapper: (value: T) => R | Promise<R>,
  options: MapFilterOptions = true,
): Promise<R[]> {
  if (options === null) {
    throw new Error('Options cannot be null');
  }
  // limitFunction requires the mapper to always return a promise
  const mapperAsync = async (value: T): Promise<R> => mapper(value);
  if (options === false) {
    return coll.reduce<Promise<R[]>>(
      async (acc, item) => [...(await acc), await mapperAsync(item)],
      Promise.resolve([]),
    );
  }
  const adjustedMapper =
    options === true ? mapperAsync : (await getLimitFunction())(mapperAsync, {concurrency: options.concurrency});
  return Promise.all(coll.map(adjustedMapper));
}
