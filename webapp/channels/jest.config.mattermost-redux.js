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
    reporters: [
        'default',
        ['jest-junit', {outputDirectory: 'build', outputName: 'test-results-mattermost-redux.xml'}],
    ],
};

module.exports = config;
