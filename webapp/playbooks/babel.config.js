// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const config = {
    presets: [
        ['@babel/preset-env', {
            targets: {
                chrome: 66,
                firefox: 60,
                edge: 42,
                safari: 12,
            },
            modules: false,
            corejs: 3,
            debug: false,
            useBuiltIns: 'usage',
            shippedProposals: true,
        }],
        ['@babel/preset-react', {
            useBuiltIns: true,
        }],
        ['@babel/typescript', {
            allExtensions: true,
            isTSX: true,
        }],
    ],
    plugins: [
        '@babel/plugin-proposal-class-properties',
        '@babel/plugin-syntax-dynamic-import',
        '@babel/proposal-object-rest-spread',
        '@babel/plugin-proposal-optional-chaining',
        'babel-plugin-typescript-to-proptypes',
        'babel-plugin-add-react-displayname',
        [
            'babel-plugin-styled-components',
            {
                ssr: false,
                fileName: false,
            },
        ],
        [
            'formatjs',
            {
                idInterpolationPattern: '[sha512:contenthash:base64:6]',
                ast: true,
            },
        ],
    ],
};

const NPM_TARGET = process.env.npm_lifecycle_event; //eslint-disable-line no-process-env
const targetIsDevServer = NPM_TARGET === 'dev-server';
if (targetIsDevServer) {
    config.plugins.push(require.resolve('react-refresh/babel'));
}

// Jest needs module transformation
config.env = {
    test: {
        presets: config.presets,
        plugins: config.plugins,
    },
};
config.env.test.presets[0][1].modules = 'auto';

module.exports = config;
