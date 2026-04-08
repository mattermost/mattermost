// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const {dependencies} = require('./package.json');
const corejsVersion = dependencies['core-js'];

const config = {
    presets: [
        ['@babel/preset-env', {
            targets: {
                chrome: 110,
                firefox: 102,
                edge: 110,
                safari: '16.2',
            },
            corejs: corejsVersion,
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
        [
            'babel-plugin-styled-components',
            {
                ssr: false,
                fileName: false,
            },
        ],
    ],
    sourceType: 'unambiguous',
};

module.exports = config;
