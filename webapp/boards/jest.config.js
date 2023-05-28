// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** @type {import('jest').Config} */

const config = {
    transform: {
        '^.+\\.(t|j)sx?$': ['@swc/jest'],
    },
    moduleFileExtensions: [
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'node',
    ],
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    transformIgnorePatterns: [
        '/nanoevents/',
        'node_modules/(?!react-native|react-router|react-day-picker)',
    ],
    testEnvironment: 'jsdom',
    collectCoverage: true,
    collectCoverageFrom: [
        'src/**/*.{ts,tsx,js,jsx}',
        '!src/test/**',
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
    ],
    clearMocks: true,
    coverageReporters: [
        'lcov',
        'text-summary',
    ],
    moduleNameMapper: {
        '^.+\\.(scss|css)$': '<rootDir>/src/test/style_mock.json',
        '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js',
        '\\.(scss|css)$': '<rootDir>/__mocks__/styleMock.js',
        '^bundle-loader\\?lazy\\!(.*)$': '$1',
        '^src(.*)$': '<rootDir>/src$1',
        '^i18n(.*)$': '<rootDir>/i18n$1',
        '^static(.*)$': '<rootDir>/static$1',
        '^moment(.*)$': '<rootDir>/../node_modules/moment$1',
    },
    moduleDirectories: [
        'src',
        'node_modules',
    ],
    reporters: [
        'default',
        'jest-junit',
    ],
    setupFiles: [
        'jest-canvas-mock',
    ],
    setupFilesAfterEnv: [
        '<rootDir>/src/test/setup.tsx',
    ],
    testTimeout: 60000,
    testEnvironmentOptions: {
        url: 'http://localhost:8065',
    },
};

module.exports = config;
