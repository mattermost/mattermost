// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="vitest/globals" />

/* eslint-disable no-console */

import * as util from 'node:util';

import * as matchers from '@testing-library/jest-dom/matchers';
import nodeFetch from 'node-fetch';

// Use node-fetch for nock compatibility (nock doesn't intercept native fetch)
// This is needed for tests that use nock to mock HTTP requests
globalThis.fetch = nodeFetch as unknown as typeof fetch;

// Mock localforage-observable and set up global Observable before store initialization
// This must be imported first to prevent "Observable is not defined" errors
import './localforage-observable_mock_vitest';
import './mattermost-redux-store_mock_vitest';
import './performance_mock_vitest';
import './redux-persist_mock_vitest';
import './react-intl_mock_vitest';
import './react-router-dom_mock_vitest';
import './react-tippy_mock_vitest';
import './mui-styled-engine_mock_vitest';
import './react-redux_mock_vitest';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Set timezone
// eslint-disable-next-line no-process-env
process.env.TZ = 'UTC';

// Setup window.location
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

// Setup document commands
const supportedCommands = ['copy', 'insertText'];

Object.defineProperty(document, 'queryCommandSupported', {
    value: (cmd: string) => supportedCommands.includes(cmd),
});

Object.defineProperty(document, 'execCommand', {
    value: (cmd: string) => supportedCommands.includes(cmd),
});

document.documentElement.style.fontSize = '12px';

// Setup ResizeObserver
global.ResizeObserver = require('resize-observer-polyfill');

// Mock window.getComputedStyle to handle pseudoElt parameter
// jsdom doesn't implement getComputedStyle with pseudoElt, which SimpleBar uses
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
    if (pseudoElt) {
        // Return a minimal CSSStyleDeclaration for pseudo elements
        return {
            getPropertyValue: () => '',
            content: '',
            width: '0px',
            height: '0px',
        } as unknown as CSSStyleDeclaration;
    }
    return originalGetComputedStyle(elt);
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

let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
    warnSpy = vi.spyOn(console, 'warn');
    errorSpy = vi.spyOn(console, 'error');
});

afterEach(() => {
    const warns: string[][] = [];
    const errors: string[][] = [];

    for (const call of warnSpy.mock.calls) {
        if (isDependencyWarning(call as string[])) {
            continue;
        }

        warns.push(call as string[]);
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

        // Ignore styled-components CSS-related warnings and other non-critical React warnings
        // These don't affect test validity
        const callStr = call[0]?.toString?.() ?? '';
        if (
            callStr.includes(':first-child') ||
            callStr.includes(':nth-child') ||
            callStr.includes('potentially unsafe when doing server-side rendering') ||
            callStr.includes('Using kebab-case for css properties in objects is not supported') ||
            callStr.includes('Each child in a list should have a unique "key" prop') ||
            callStr.includes('@formatjs/intl Error FORMAT_ERROR') ||
            callStr.includes('The intl string context variable') ||
            callStr.includes('FORMAT_ERROR') ||
            callStr.includes('Function components cannot be given refs') ||
            callStr.includes('You provided a `value` prop to a form field without an `onChange` handler') ||
            callStr.includes('Cannot read properties of undefined') ||
            callStr.includes('The above error occurred in the')
        ) {
            continue;
        }

        errors.push(call as string[]);
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

// Extend expect with custom matcher
expect.extend({
    arrayContainingExactly(received: string[], actual: string[]) {
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
