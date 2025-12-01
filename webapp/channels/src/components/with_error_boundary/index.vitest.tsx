// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getChannelsInCategoryOrder} from 'selectors/views/channel_sidebar';

import {render, screen, userEvent} from 'tests/vitest_react_testing_utils';

import type {FallbackProps} from '.';
import withErrorBoundary from '.';

function renderFallbackWithRetry({clearError}: FallbackProps) {
    return (
        <div>
            <p>{'A rendering error occurred'}</p>
            <button onClick={clearError}>{'Try again?'}</button>
        </div>
    );
}

describe('withErrorBoundary', () => {
    // eslint-disable-next-line no-console
    const origError = console.error;
    let originalStderrWrite: typeof process.stderr.write;

    beforeEach(() => {
        // eslint-disable-next-line no-console
        console.error = vi.fn();

        // Suppress jsdom stderr output for expected errors
        originalStderrWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = vi.fn() as typeof process.stderr.write;
    });
    afterEach(() => {
        // eslint-disable-next-line no-console
        console.error = origError;
        process.stderr.write = originalStderrWrite;
    });

    test('should render the component normally', () => {
        function TestComponent() {
            return <span>{'TestComponent'}</span>;
        }
        const WrappedTestComponent = withErrorBoundary(TestComponent, {
            renderFallback: renderFallbackWithRetry,
        });

        render(
            <WrappedTestComponent/>,
        );

        expect(screen.getByText('TestComponent')).toBeVisible();
    });

    test('should render fallback when an error occurs during rendering', () => {
        function TestComponent(): JSX.Element {
            const obj = {} as any;

            return <span>{'TestComponent' + obj.someField.thatDoesnt.exist.toString()}</span>;
        }
        const WrappedTestComponent = withErrorBoundary(TestComponent, {
            renderFallback: renderFallbackWithRetry,
        });

        render(
            <WrappedTestComponent/>,
        );

        expect(screen.getByText('A rendering error occurred')).toBeVisible();
    });

    test('should render fallback when an error occurs in a hook', () => {
        function useAnErrorForSomeReason(): string {
            throw new Error('hook error');
        }
        function TestComponent(): JSX.Element {
            const extraText = useAnErrorForSomeReason();

            return <span>{'TestComponent' + extraText}</span>;
        }
        const WrappedTestComponent = withErrorBoundary(TestComponent, {
            renderFallback: renderFallbackWithRetry,
        });

        render(
            <WrappedTestComponent/>,
        );

        expect(screen.getByText('A rendering error occurred')).toBeVisible();
    });

    test('should render fallback when an error occurs in a selector', () => {
        function TestComponent(): JSX.Element {
            const extraText = useSelector(getChannelsInCategoryOrder);

            return <span>{'TestComponent' + extraText}</span>;
        }
        const WrappedTestComponent = withErrorBoundary(TestComponent, {
            renderFallback: renderFallbackWithRetry,
        });

        render(
            <WrappedTestComponent/>,
        );

        expect(screen.getByText('A rendering error occurred')).toBeVisible();
    });

    test('the user should be able to retry rendering the component', async () => {
        let throwError = true;

        function TestComponent(): JSX.Element {
            let obj: any;
            if (throwError) {
                obj = {};
            } else {
                obj = {
                    someField: {
                        thatDoesnt: {
                            exist: [1, 2, 3],
                        },
                    },
                };
            }

            return <span>{'TestComponent ' + obj.someField.thatDoesnt.exist.toString()}</span>;
        }
        const WrappedTestComponent = withErrorBoundary(TestComponent, {
            renderFallback: renderFallbackWithRetry,
        });

        render(
            <WrappedTestComponent/>,
        );

        expect(screen.queryByText('A rendering error occurred')).toBeVisible();
        expect(screen.queryByText('TestComponent 1,2,3')).toBeNull();

        throwError = false;

        await userEvent.click(screen.getByText('Try again?'));

        expect(screen.queryByText('A rendering error occurred')).toBeNull();
        expect(screen.queryByText('TestComponent 1,2,3')).toBeVisible();
    });
});
