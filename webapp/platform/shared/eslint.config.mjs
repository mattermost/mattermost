import formatjsPlugin from 'eslint-plugin-formatjs';
import noOnlyTestsPlugin from 'eslint-plugin-no-only-tests';

import eslintPlugin from '@mattermost/eslint-plugin';

export default [
    ...eslintPlugin.configs.react,
    {
        files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
        plugins: {
            formatjs: formatjsPlugin
        }
    },
    {
        files: ['**/*.test.js', '**/*.test.jsx', '**/*.test.ts', '**/*.test.tsx'],
        plugins: {
            'no-only-tests': noOnlyTestsPlugin
        },
        rules: {
            'no-only-tests/no-only-tests': ['error', {'focus': ['only', 'skip']}]
        }
    }
];
