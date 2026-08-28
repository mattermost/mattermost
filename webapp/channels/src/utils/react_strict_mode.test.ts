// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {installReactStrictModeDiagnostics} from './react_strict_mode';

/* eslint-disable no-console */

describe('installReactStrictModeDiagnostics', () => {
    const originalConsoleError = console.error;

    beforeEach(() => {
        jest.useFakeTimers();
        console.error = jest.fn();
        delete window.reactStrictModeViolations;
        delete window.reactStrictModeThrowSynchronously;
    });

    afterEach(() => {
        jest.useRealTimers();
        console.error = originalConsoleError;
    });

    function flushPendingThrow() {
        // The rethrow is queued as a task, so running the timers is what surfaces it.
        jest.runOnlyPendingTimers();
    }

    test('should rethrow a concurrency hazard warning out of band', () => {
        installReactStrictModeDiagnostics();

        console.error(
            'Warning: Cannot update a component (`%s`) while rendering a different component (`%s`).',
            'ChannelView',
            'PostList',
        );

        expect(flushPendingThrow).toThrow(
            'React strict mode violation: Warning: Cannot update a component (`ChannelView`) while rendering a different component (`PostList`).',
        );
    });

    test('should throw synchronously when asked to', () => {
        installReactStrictModeDiagnostics();
        window.reactStrictModeThrowSynchronously = true;

        expect(() => console.error('Warning: Maximum update depth exceeded.')).toThrow(
            'React strict mode violation: Warning: Maximum update depth exceeded.',
        );
    });

    test('should keep the component stack out of the message but on the error', () => {
        installReactStrictModeDiagnostics();

        console.error(
            'Warning: findDOMNode is deprecated in StrictMode.%s',
            '\n    in Overlay (at tooltip.tsx:20)\n    in Tooltip',
        );

        let thrown: Error | undefined;
        try {
            flushPendingThrow();
        } catch (error) {
            thrown = error as Error;
        }

        expect(thrown?.message).toBe('React strict mode violation: Warning: findDOMNode is deprecated in StrictMode.');
        expect(thrown?.stack).toContain('in Overlay (at tooltip.tsx:20)');
    });

    test('should record every distinct violation on the window', () => {
        installReactStrictModeDiagnostics();

        console.error('Warning: Maximum update depth exceeded.');
        console.error('Warning: findDOMNode is deprecated in StrictMode.');

        expect(window.reactStrictModeViolations).toEqual([
            {message: 'Warning: Maximum update depth exceeded.'},
            {message: 'Warning: findDOMNode is deprecated in StrictMode.'},
        ]);
    });

    test('should report a repeated violation only once', () => {
        installReactStrictModeDiagnostics();

        console.error('Warning: The result of getSnapshot should be cached to avoid an infinite loop');
        expect(flushPendingThrow).toThrow();

        console.error('Warning: The result of getSnapshot should be cached to avoid an infinite loop');
        expect(flushPendingThrow).not.toThrow();

        expect(window.reactStrictModeViolations).toHaveLength(1);
    });

    test('should leave unrelated console errors alone', () => {
        installReactStrictModeDiagnostics();

        console.error('Warning: Failed prop type: Invalid prop `children` supplied to `Post`.');

        expect(flushPendingThrow).not.toThrow();
        expect(window.reactStrictModeViolations).toEqual([]);
    });

    test('should still write the warning to the console', () => {
        const spy = jest.spyOn(console, 'error');

        installReactStrictModeDiagnostics();
        console.error('Warning: Maximum update depth exceeded.');

        expect(spy).toHaveBeenCalledWith('Warning: Maximum update depth exceeded.');
    });
});
