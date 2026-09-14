import {defineConfig} from '@eloqnt/cli';

export default defineConfig({
  messages: {
    path: './src/i18n/{code}',
    locales: 'infer',
    sourceLocale: 'en',
    format: 'json'
  }
});
