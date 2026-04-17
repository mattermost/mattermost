// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

import * as util from 'node:util';

import nodeFetch from 'node-fetch';

import '@testing-library/jest-dom';

import './performance_mock';
import './redux-persist_mock';
import './react-intl_mock';
import './react-router-dom_mock';
import './react-tippy_mock';
import './react_virtualized_auto_sizer_mock';

module.exports = async () => {
    // eslint-disable-next-line no-process-env
    process.env.TZ = 'UTC';
};

global.window = Object.create(window);

// The current version of jsdom that's used by jest-environment-jsdom 29 doesn't support fetch, so we have to
// use node-fetch despite some mismatched parameters.
globalThis.fetch = nodeFetch as unknown as typeof fetch;

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

// jsdom doesn't fully implement getComputedStyle with pseudoElement parameter.
// SimpleBar (scrollbar library) calls it during initialization, causing console noise.
const origGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
    if (pseudoElt) {
        return {} as CSSStyleDeclaration;
    }
    return origGetComputedStyle(elt);
};

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
        // jsdom doesn't implement navigation, but this is expected behavior in tests
        const errorStr = call[0] instanceof Error ? call[0].message : String(call[0]);
        if (errorStr.includes('Not implemented:')) {
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
        let hasActWarning = false;
        for (const call of warns) {
            message += `\n\t- (warning) ${formatCall(call)}`;
        }
        for (const call of errors) {
            message += `\n\t- (error) ${formatCall(call)}`;
            const msg = String(call[0]);
            if (msg.includes('inside a test was not wrapped in act')) {
                hasActWarning = true;
            }
        }

        if (hasActWarning) {
            message += '\n\n' +
                'To fix the act() warning, try one of the following:\n' +
                '  - Add `await` to `renderWithContext()` or `renderHookWithContext()` calls\n' +
                '  - Wrap state-triggering code in `await act(async () => { ... })`\n' +
                '  - Use `await waitFor(() => ...)` to wait for async state updates\n' +
                '  - For loading-state tests, use a never-resolving promise to prevent async state updates from leaking';
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
