## [6.3.2](https://github.com/appium/asyncbox/compare/v6.3.1...v6.3.2) (2026-07-02)

### Miscellaneous Chores

* **deps:** bump actions/checkout from 6 to 7 ([#76](https://github.com/appium/asyncbox/issues/76)) ([b6ac875](https://github.com/appium/asyncbox/commit/b6ac8753ba5a914fdcff492deebad4ec72ba523e))

## [6.3.1](https://github.com/appium/asyncbox/compare/v6.3.0...v6.3.1) (2026-07-01)

### Miscellaneous Chores

* **deps-dev:** bump eslint to v10 ([#73](https://github.com/appium/asyncbox/issues/73)) ([03a6f27](https://github.com/appium/asyncbox/commit/03a6f278ef4a402d710650b734e270f711b494e8))

## [6.3.0](https://github.com/appium/asyncbox/compare/v6.2.0...v6.3.0) (2026-05-10)

### Features

* Make sleep cancellable ([#72](https://github.com/appium/asyncbox/issues/72)) ([8e2ff41](https://github.com/appium/asyncbox/commit/8e2ff4161a6b046c3e0433eecef3c80a3300f760))

## [6.2.0](https://github.com/appium/asyncbox/compare/v6.1.0...v6.2.0) (2026-05-03)

### Features

* Add withTimeout helper ([#70](https://github.com/appium/asyncbox/issues/70)) ([12b4b2f](https://github.com/appium/asyncbox/commit/12b4b2fda29611945c0a52d021e8bd8db6cccb19))

## [6.1.0](https://github.com/appium/asyncbox/compare/v6.0.1...v6.1.0) (2026-01-28)

### Features

* add option to set asyncmap/asyncfilter concurrency pool limit ([#58](https://github.com/appium/asyncbox/issues/58)) ([b1e6535](https://github.com/appium/asyncbox/commit/b1e65355adafd8325b2fbfe7199810e7ab9fa486))

### Miscellaneous Chores

* **deps-dev:** bump @appium/eslint-config-appium-ts ([#59](https://github.com/appium/asyncbox/issues/59)) ([e38530e](https://github.com/appium/asyncbox/commit/e38530e921ea009277befc7050ca281f31efe19a))

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
