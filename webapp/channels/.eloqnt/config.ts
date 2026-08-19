import {defineConfig} from '@eloqnt/cli';

export default defineConfig({
  messages: {
    path: './src/i18n',
    locales: 'infer',
    sourceLocale: 'en',
    format: 'json'
  },
  lint: {
    rules: {
      // `la` and `pr` have no CLDR data at all, so no locale code can satisfy
      // this rule, and `ar_SA.json` is empty and unreferenced by imports.ts.
      'invalid-locale': 'off'
    }
  }
});
