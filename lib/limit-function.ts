import type {limitFunction} from 'p-limit';

type PLimitModule = {limitFunction: typeof limitFunction};

// p-limit is ESM-only. tsc downlevels a plain `import()` in CommonJS output into a
// require()-in-a-microtask, which still hits Node's require(esm) interop and can race with a
// concurrent dynamic import() of the same module elsewhere in the process
// (ERR_REQUIRE_ESM_RACE_CONDITION). Route through `new Function` so tsc can't see or rewrite the
// import() call, keeping it a genuine native dynamic import in both the ESM and CJS builds.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<PLimitModule>;

let limitFunctionPromise: Promise<PLimitModule> | undefined;
export async function getLimitFunction() {
  limitFunctionPromise ??= dynamicImport('p-limit');
  return (await limitFunctionPromise).limitFunction;
}
