// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['**/*.vitest.{ts,tsx}'],
        exclude: ['node_modules', 'dist'],
        setupFiles: ['./src/tests/setup_vitest.ts'],
        testTimeout: 10000,
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
        coverage: {
            provider: 'v8',
            reporter: ['lcov', 'text-summary'],
            include: ['src/**/*.{js,jsx,ts,tsx}'],
            exclude: [
                'node_modules/',
                'src/packages/mattermost-redux/src/selectors/create_selector',
            ],
        },
        snapshotFormat: {
            escapeString: true,
            printBasicPrototype: true,
        },
        environmentOptions: {
            jsdom: {
                url: 'http://localhost:8065',
            },
        },
    },
    resolve: {
        alias: {
            // External packages
            // Handle imports like '@mattermost/components/src/hooks/...' (with explicit /src/)
            '@mattermost/components/src': path.resolve(__dirname, '../platform/components/src'),
            '@mattermost/components': path.resolve(__dirname, '../platform/components/src'),
            '@mattermost/client/lib': path.resolve(__dirname, '../platform/client/lib'),
            '@mattermost/client': path.resolve(__dirname, '../platform/client/src'),
            '@mattermost/types': path.resolve(__dirname, '../platform/types/src'),
            'mattermost-redux/test': path.resolve(__dirname, 'src/packages/mattermost-redux/test'),
            'mattermost-redux': path.resolve(__dirname, 'src/packages/mattermost-redux/src'),

            // Internal src paths (matching Jest moduleDirectories: ['src'])
            'actions': path.resolve(__dirname, 'src/actions'),
            'client': path.resolve(__dirname, 'src/client'),
            'components': path.resolve(__dirname, 'src/components'),
            'hooks': path.resolve(__dirname, 'src/hooks'),
            'i18n': path.resolve(__dirname, 'src/i18n'),
            'images': path.resolve(__dirname, 'src/images'),
            'packages': path.resolve(__dirname, 'src/packages'),
            'plugins': path.resolve(__dirname, 'src/plugins'),
            'reducers': path.resolve(__dirname, 'src/reducers'),
            'sass': path.resolve(__dirname, 'src/sass'),
            'selectors': path.resolve(__dirname, 'src/selectors'),
            'sounds': path.resolve(__dirname, 'src/sounds'),
            'store': path.resolve(__dirname, 'src/store'),
            'stores': path.resolve(__dirname, 'src/stores'),
            'tests': path.resolve(__dirname, 'src/tests'),
            'types': path.resolve(__dirname, 'src/types'),
            'utils': path.resolve(__dirname, 'src/utils'),
            'module_registry': path.resolve(__dirname, 'src/module_registry'),

            // MUI styled engine swap (use styled-components instead of emotion)
            '@mui/styled-engine': path.resolve(__dirname, '../node_modules/@mui/styled-engine-sc'),
        },
    },
    assetsInclude: ['**/*.svg', '**/*.png', '**/*.jpg', '**/*.gif'],
});
