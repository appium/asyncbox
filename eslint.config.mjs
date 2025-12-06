import appiumConfig from '@appium/eslint-config-appium-ts';
import {defineConfig, globalIgnores} from 'eslint/config';

export default defineConfig([
  {
    extends: [appiumConfig],
  },
  {
    files: ['test/**/*.{js,ts}'],
    rules: {
      'func-names': 'off'
    }
  },
  globalIgnores(['build']),
]);
