## [6.0.1](https://github.com/appium/asyncbox/compare/v6.0.0...v6.0.1) (2026-01-22)

### Miscellaneous Chores

* drop bluebird and lodash ([#57](https://github.com/appium/asyncbox/issues/57)) ([c25537b](https://github.com/appium/asyncbox/commit/c25537bba50970a1258d24f4a1efe704b90b21d5))

## [6.0.0](https://github.com/appium/asyncbox/compare/v5.0.0...v6.0.0) (2026-01-21)

### ⚠ BREAKING CHANGES

* removed the `parallel` method. Use native `Promise.all` instead
* removed the `asyncify` method. Call your async method directly

### Features

* remove `parallel` and `asyncify` as obsolete ([#55](https://github.com/appium/asyncbox/issues/55)) ([c757f52](https://github.com/appium/asyncbox/commit/c757f524e41420f807ebcd7977c0308223433b6f))

## [5.0.0](https://github.com/appium/asyncbox/compare/v4.1.1...v5.0.0) (2026-01-20)

### ⚠ BREAKING CHANGES

* remove `nodeify` and `nodeifyAll` functions as obsolete

### Features

* remove nodeify* functions as obsolete ([#54](https://github.com/appium/asyncbox/issues/54)) ([3748dcc](https://github.com/appium/asyncbox/commit/3748dccf359d8f68cdeb72660cf76437ef46adfe))

## [4.1.1](https://github.com/appium/asyncbox/compare/v4.1.0...v4.1.1) (2026-01-20)

### Bug Fixes

* revert "feat: remove nodeify* functions as obsolete ([#52](https://github.com/appium/asyncbox/issues/52))" ([#53](https://github.com/appium/asyncbox/issues/53)) ([cf19ced](https://github.com/appium/asyncbox/commit/cf19ced3d61eab740de45548c7ff67b928e7dcb3))

## [4.1.0](https://github.com/appium/asyncbox/compare/v4.0.2...v4.1.0) (2026-01-20)

### Features

* remove nodeify* functions as obsolete ([#52](https://github.com/appium/asyncbox/issues/52)) ([b50a289](https://github.com/appium/asyncbox/commit/b50a289ddd07f86e80dbb9f89017a8a99160d209))

## [4.0.2](https://github.com/appium/asyncbox/compare/v4.0.1...v4.0.2) (2026-01-20)

### Miscellaneous Chores

* add missing release config files ([#51](https://github.com/appium/asyncbox/issues/51)) ([d518c22](https://github.com/appium/asyncbox/commit/d518c2236ba4389001227bc0af1293870d0b7f6e))
* Document and reexport types ([#50](https://github.com/appium/asyncbox/issues/50)) ([1784ac2](https://github.com/appium/asyncbox/commit/1784ac28598b018673bf332b7c029f2e43672b15))
