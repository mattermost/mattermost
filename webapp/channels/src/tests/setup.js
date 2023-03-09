// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Adapter from 'enzyme-adapter-react-17-updated';
import {configure} from 'enzyme';

import '@testing-library/jest-dom';

import './redux-persist_mock';
import './react-intl_mock';
import './react-router-dom_mock';
import './react-tippy_mock';

global.performance = {};
require('isomorphic-fetch');

configure({adapter: new Adapter()});

global.window = Object.create(window);
Object.defineProperty(window, 'location', {
    value: {
        href: 'http://localhost:8065',
        origin: 'http://localhost:8065',
        port: '8065',
        protocol: 'http:',
        search: '',
    },
});

const supportedCommands = ['copy'];

Object.defineProperty(document, 'queryCommandSupported', {
    value: (cmd) => supportedCommands.includes(cmd),
});

Object.defineProperty(document, 'execCommand', {
    value: (cmd) => supportedCommands.includes(cmd),
});

document.documentElement.style.fontSize = '12px';

// https://mui.com/material-ui/guides/styled-engine/
jest.mock('@mui/styled-engine', () => {
    const styledEngineSc = require('@mui/styled-engine-sc');
    return styledEngineSc;
});

// isDependencyWarning returns true when the given console.warn message is coming from a dependency using deprecated
// React lifecycle methods.
function isDependencyWarning(params) {
    function paramsHasComponent(name) {
        return params.some((param) => param.includes(name));
    }

    return params[0].includes('Please update the following components:') && (

        // React Bootstrap
        paramsHasComponent('Modal') ||
        paramsHasComponent('Portal') ||
        paramsHasComponent('Overlay') ||
        paramsHasComponent('Position') ||

        // React-Select
        paramsHasComponent('Select')
    );
}

let warns;
let errors;
beforeAll(() => {
    console.originalWarn = console.warn;
    console.warn = jest.fn((...params) => {
        // Ignore any deprecation warnings coming from dependencies
        if (isDependencyWarning(params)) {
            return;
        }

        console.originalWarn(...params);
        warns.push(params);
    });

    console.originalError = console.error;
    console.error = jest.fn((...params) => {
        console.originalError(...params);
        errors.push(params);
    });
});

beforeEach(() => {
    warns = [];
    errors = [];
});

afterEach(() => {
    if (warns.length > 0 || errors.length > 0) {
        const message = 'Unexpected console logs' + warns + errors;
        throw new Error(message);
    }
});

expect.extend({
    arrayContainingExactly(received, actual) {
        const pass = received.sort().join(',') === actual.sort().join(',');
        if (pass) {
            return {
                message: () =>
                    `expected ${received} to not contain the exact same values as ${actual}`,
                pass: true,
            };
        }
        return {
            message: () =>
                `expected ${received} to not contain the exact same values as ${actual}`,
            pass: false,
        };
    },
});
