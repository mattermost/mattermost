// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** @type {import('jest').Config} */

const config = {
    snapshotSerializers: ['enzyme-to-json/serializer'],
    testPathIgnorePatterns: ['/node_modules/'],
    clearMocks: true,
    collectCoverageFrom: [
        'src/actions/**/*.{js,jsx,ts,tsx}',
        'src/client/**/*.{js,jsx,ts,tsx}',
        'src/components/**/*.{jsx,tsx}',
        'src/plugins/**/*.{js,jsx,ts,tsx}',
        'src/reducers/**/*.{js,jsx,ts,tsx}',
        'src/routes/**/*.{js,jsx,ts,tsx}',
        'src/selectors/**/*.{js,jsx,ts,tsx}',
        'src/stores/**/*.{js,jsx,ts,tsx}',
        'src/utils/**/*.{js,jsx,ts,tsx}',
    ],
    coverageReporters: ['lcov', 'text-summary'],
    fakeTimers: {
        doNotFake: ['performance'],
    },
    moduleNameMapper: {
        '^@mattermost/(components)$': '<rootDir>/../platform/$1/src',
        '^@mattermost/(client)$': '<rootDir>/../platform/$1/src',
        '^@mattermost/(types)/(.*)$': '<rootDir>/../platform/$1/src/$2',
        '^mattermost-redux/test/(.*)$':
            '<rootDir>/src/packages/mattermost-redux/test/$1',
        '^mattermost-redux/(.*)$': '<rootDir>/src/packages/mattermost-redux/src/$1',
        '^.+\\.(jpg|jpeg|png|apng|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
            '<rootDir>/src/tests/image_url_mock.json',
        '^.+\\.(css|less|scss)$': 'identity-obj-proxy',
        '^.*i18n.*\\.(json)$': '<rootDir>/src/tests/i18n_mock.json',
    },
    moduleDirectories: ['src', 'node_modules'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    reporters: [
        'default',
        ['jest-junit', {outputDirectory: 'build', outputName: 'test-results.xml'}],
    ],
    transformIgnorePatterns: [
        'node_modules/(?!react-native|react-router|pdfjs-dist|p-queue|p-timeout|@mattermost/compass-components|@mattermost/compass-icons|cidr-regex|ip-regex|serialize-error)',
    ],
    transform: {
        '^.+\\.(js|jsx|ts|tsx|mjs)$': 'babel-jest',
    },
    setupFiles: ['jest-canvas-mock'],
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup_jest.ts'],
    testEnvironment: 'jsdom',
    testTimeout: 60000,
    testEnvironmentOptions: {
        url: 'http://localhost:8065',
    },
    watchPlugins: [
        'jest-watch-typeahead/filename',
        'jest-watch-typeahead/testname',
    ],
    snapshotFormat: {
        escapeString: true,
        printBasicPrototype: true,
    },
};

module.exports = config;
