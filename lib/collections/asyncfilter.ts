import type {MapFilterOptions} from '../shared/types.js';
import {limitFunction} from './limit-function.js';

/**
 * Similar to `Array.prototype.filter`; runs in parallel, serial, or with custom concurrency pool
 * @param coll - The collection to filter
 * @param filter - The function to test each element
 * @param options - Options for controlling parallelism (default: true - fully parallel)
 */
export async function asyncfilter<T>(
  coll: T[],
  filter: (value: T) => boolean | Promise<boolean>,
  options: MapFilterOptions = true,
): Promise<T[]> {
  if (options === null) {
    throw new Error('Options cannot be null');
  }
  // limitFunction requires the filter to always return a promise
  const filterAsync = async (value: T): Promise<boolean> => filter(value);
  if (options === false) {
    const items = coll.slice();
    const results: T[] = [];
    for (let i = 0; i < items.length; i++) {
      if (i in items) {
        const item = items[i];
        if (await filterAsync(item)) {
          results.push(item);
        }
      }
    }
    return results;
  }
  const adjustedFilter =
    options === true ? filterAsync : limitFunction(filterAsync, {concurrency: options.concurrency});
  const bools = await Promise.all(coll.map(adjustedFilter));
  return coll.reduce<T[]>((acc, item, i) => {
    if (bools[i]) {
      acc.push(item);
    }
    return acc;
  }, []);
}
