// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** @type {import('jest').Config} */

const baseConfig = require('./jest.config.js');

const config = {
    ...baseConfig,
    displayName: 'mattermost-redux',
    testMatch: [
        '<rootDir>/src/packages/mattermost-redux/src/**/*.test.{js,jsx,ts,tsx}',
    ],
    collectCoverageFrom: [
        'src/packages/mattermost-redux/src/**/*.{js,jsx,ts,tsx}',
    ],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        'src/packages/mattermost-redux/src/selectors/create_selector',
    ],
    reporters: [
        'default',
        ['jest-junit', {outputDirectory: 'build', outputName: 'test-results-mattermost-redux.xml'}],
    ],
};

module.exports = config;
