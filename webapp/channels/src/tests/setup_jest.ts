// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

import {configure} from 'enzyme';
import Adapter from 'enzyme-adapter-react-17-updated';

import '@testing-library/jest-dom';
import 'isomorphic-fetch';

import './performance_mock';
import './redux-persist_mock';
import './react-intl_mock';
import './react-router-dom_mock';
import './react-tippy_mock';

configure({adapter: new (Adapter as any)()});

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

const supportedCommands = ['copy', 'insertText'];

Object.defineProperty(document, 'queryCommandSupported', {
    value: (cmd: string) => supportedCommands.includes(cmd),
});

Object.defineProperty(document, 'execCommand', {
    value: (cmd: string) => supportedCommands.includes(cmd),
});

document.documentElement.style.fontSize = '12px';

// https://mui.com/material-ui/guides/styled-engine/
jest.mock('@mui/styled-engine', () => {
    const styledEngineSc = require('@mui/styled-engine-sc');
    return styledEngineSc;
});

global.ResizeObserver = require('resize-observer-polyfill');

// isDependencyWarning returns true when the given console.warn message is coming from a dependency using deprecated
// React lifecycle methods.
function isDependencyWarning(params: string[]) {
    function paramsHasComponent(name: string) {
        return params.some((param) => param.includes(name));
    }

    return params[0].includes('Please update the following components:') && (

        // React Bootstrap
        paramsHasComponent('Modal') ||
        paramsHasComponent('Portal') ||
        paramsHasComponent('Overlay') ||
        paramsHasComponent('Position') ||
        paramsHasComponent('Dropdown') ||

        // React-Select
        paramsHasComponent('Select')
    );
}

let warns: string[][];
let errors: string[][];
beforeAll(() => {
    const originalWarn = console.warn;
    console.warn = jest.fn((...params) => {
        // Ignore any deprecation warnings coming from dependencies
        if (isDependencyWarning(params)) {
            return;
        }

        originalWarn(...params);
        warns.push(params);
    });

    const originalError = console.error;
    console.error = jest.fn((...params) => {
        originalError(...params);
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
