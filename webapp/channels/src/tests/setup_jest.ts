// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

import * as util from 'node:util';

import Adapter from '@cfaester/enzyme-adapter-react-18';
import {configure} from 'enzyme';

import '@testing-library/jest-dom';
import 'isomorphic-fetch';

import './performance_mock';
import './redux-persist_mock';
import './react-intl_mock';
import './react-router-dom_mock';
import './react-tippy_mock';

module.exports = async () => {
    // eslint-disable-next-line no-process-env
    process.env.TZ = 'UTC';
};

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
        paramsHasComponent('Tabs')
    );
}

let warnSpy: jest.SpyInstance<void, Parameters<typeof console.warn>>;
let errorSpy: jest.SpyInstance<void, Parameters<typeof console.error>>;
beforeAll(() => {
    warnSpy = jest.spyOn(console, 'warn');
    errorSpy = jest.spyOn(console, 'error');
});

afterEach(() => {
    const warns = [];
    const errors = [];

    for (const call of warnSpy.mock.calls) {
        if (isDependencyWarning(call)) {
            continue;
        }

        warns.push(call);
    }

    for (const call of errorSpy.mock.calls) {
        if (
            typeof call[0] === 'string' && (
                call[0].includes('inside a test was not wrapped in act') ||
                call[0].includes('A suspended resource finished loading inside a test, but the event was not wrapped in act')
            )
        ) {
            // These warnings indicate that we're not using React Testing Library properly because we're not waiting
            // for some async action to complete. Sometimes, these are side effects during the test which are missed
            // which could lead our tests to be invalid, but more often than not, this warning is printed because of
            // unhandled side effects from something that wasn't being tested (such as some data being loaded that we
            // didn't care about in that test case).
            //
            // Ideally, we wouldn't ignore these, but so many of our existing tests are set up in a way that we can't
            // fix this everywhere at the moment.
            continue;
        }

        errors.push(call);
    }

    if (warns.length > 0 || errors.length > 0) {
        function formatCall(call: string[]) {
            const args = [...call];
            const format = args.shift();

            let message = util.format(format, ...args);
            message = message.split('\n')[0];

            return message;
        }

        let message = 'Unexpected console errors:';
        for (const call of warns) {
            message += `\n\t- (warning) ${formatCall(call)}`;
        }
        for (const call of errors) {
            message += `\n\t- (error) ${formatCall(call)}`;
        }

        throw new Error(message);
    }

    warnSpy.mockReset();
    errorSpy.mockReset();
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

// Redefine react-redux to make it "configurable" so that we can use jest.spyOn with it
// https://stackoverflow.com/questions/67872622/jest-spyon-not-working-on-index-file-cannot-redefine-property
jest.mock('react-redux', () => ({
    __esModule: true,
    ...jest.requireActual('react-redux'),
}));
