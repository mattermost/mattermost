import {defineConfig} from '@eloqnt/cli';

export default defineConfig({
  messages: {
    path: './src/i18n/{code}',
    locales: 'infer',
    sourceLocale: 'en',
    format: 'json',
    codes: {
      // `ar_SA.json` is the one file here spelled the POSIX way
      'ar-SA': 'ar_SA'
    }
  },
  lint: {
    overrides: [
      {
        // `pr` is a language picker entry rather than a language code, so no
        // code can satisfy this rule for it
        locales: ['pr'],
        rules: {'invalid-locale': 'off'}
      }
    ]
  }
});
