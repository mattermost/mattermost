// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {doPostActionWithInlineContext} from 'mattermost-redux/actions/posts';

import {act, fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import InlineActionButton from './index';

jest.mock('mattermost-redux/actions/posts', () => ({
    doPostActionWithInlineContext: jest.fn(),
}));

const mockedDoPostActionWithInlineContext = doPostActionWithInlineContext as jest.MockedFunction<typeof doPostActionWithInlineContext>;

/**
 * Creates a thunk-shaped mock whose inner promise is externally controllable.
 * The thunk returned by `doPostActionWithInlineContext` is invoked by
 * redux-thunk middleware; the returned promise is what the component awaits.
 */
function setupControllablePromise() {
    let resolveFn: (value: unknown) => void = () => {};
    const promise = new Promise((resolve) => {
        resolveFn = resolve;
    });

    mockedDoPostActionWithInlineContext.mockImplementation(() => {
        return (() => promise) as unknown as ReturnType<typeof doPostActionWithInlineContext>;
    });

    return {promise, resolve: () => resolveFn({data: {}})};
}

describe('InlineActionButton', () => {
    const baseProps = {
        actionId: 'mx',
        params: 'tail=214&mds=C130J',
        postId: 'abc',
        children: 'Click me',
    };

    beforeEach(() => {
        mockedDoPostActionWithInlineContext.mockReset();
    });

    test('renders with children as button label', () => {
        mockedDoPostActionWithInlineContext.mockImplementation(
            () => (() => Promise.resolve({data: {}})) as unknown as ReturnType<typeof doPostActionWithInlineContext>,
        );

        renderWithContext(<InlineActionButton {...baseProps}/>);

        const button = screen.getByRole('button');
        expect(button).toBeVisible();
        expect(button).toHaveTextContent('Click me');
    });

    test('dispatches thunk with parsed inline context on click', async () => {
        const {resolve} = setupControllablePromise();

        renderWithContext(<InlineActionButton {...baseProps}/>);

        await userEvent.click(screen.getByRole('button'));

        expect(mockedDoPostActionWithInlineContext).toHaveBeenCalledTimes(1);
        expect(mockedDoPostActionWithInlineContext).toHaveBeenCalledWith('abc', 'mx', {tail: '214', mds: 'C130J'});

        // Resolve pending dispatch inside act so the trailing setState commits cleanly.
        await act(async () => {
            resolve();
        });
    });

    test('empty params results in empty context', async () => {
        const {resolve} = setupControllablePromise();

        renderWithContext(
            <InlineActionButton
                {...baseProps}
                params=''
            />,
        );

        await userEvent.click(screen.getByRole('button'));

        expect(mockedDoPostActionWithInlineContext).toHaveBeenCalledTimes(1);
        expect(mockedDoPostActionWithInlineContext).toHaveBeenCalledWith('abc', 'mx', {});

        await act(async () => {
            resolve();
        });
    });

    test('double-click prevented by ref guard', async () => {
        // Use a never-resolving promise so the first dispatch stays in-flight.
        mockedDoPostActionWithInlineContext.mockImplementation(
            () => (() => new Promise(() => {})) as unknown as ReturnType<typeof doPostActionWithInlineContext>,
        );

        renderWithContext(<InlineActionButton {...baseProps}/>);
        const button = screen.getByRole('button');

        // Fire two synchronous clicks before any microtask can run.
        // fireEvent.click invokes the handler synchronously; the ref guard
        // must block the second invocation before setState re-render lands.
        fireEvent.click(button);
        fireEvent.click(button);

        expect(mockedDoPostActionWithInlineContext).toHaveBeenCalledTimes(1);

        // Let any pending microtasks settle so teardown is clean. The dispatch
        // promise never resolves, which is fine — we only care about the guard.
        await act(async () => {
            await Promise.resolve();
        });
    });

    test('button is disabled with aria-busy while executing and re-enables when done', async () => {
        const {resolve} = setupControllablePromise();

        renderWithContext(<InlineActionButton {...baseProps}/>);
        const button = screen.getByRole('button');

        await userEvent.click(button);

        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'true');

        await act(async () => {
            resolve();
        });

        expect(button).not.toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'false');
    });

    test('unmount during dispatch does not warn about setState on unmounted component', async () => {
        const {resolve} = setupControllablePromise();

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const {unmount} = renderWithContext(<InlineActionButton {...baseProps}/>);

        await userEvent.click(screen.getByRole('button'));

        unmount();

        // Resolve the in-flight dispatch after unmount; the component's
        // mountedRef guard should prevent a stale setState call.
        await act(async () => {
            resolve();
        });

        const unmountedWarnings = consoleErrorSpy.mock.calls.filter((args) => {
            const msg = args[0];
            return typeof msg === 'string' && msg.includes('unmounted');
        });
        expect(unmountedWarnings).toHaveLength(0);

        consoleErrorSpy.mockRestore();
    });

    test('skips click when postId is empty', async () => {
        mockedDoPostActionWithInlineContext.mockImplementation(
            () => (() => Promise.resolve({data: {}})) as unknown as ReturnType<typeof doPostActionWithInlineContext>,
        );

        renderWithContext(
            <InlineActionButton
                {...baseProps}
                postId=''
            />,
        );

        await userEvent.click(screen.getByRole('button'));

        expect(mockedDoPostActionWithInlineContext).not.toHaveBeenCalled();
    });

    test('skips click when actionId is empty', async () => {
        mockedDoPostActionWithInlineContext.mockImplementation(
            () => (() => Promise.resolve({data: {}})) as unknown as ReturnType<typeof doPostActionWithInlineContext>,
        );

        renderWithContext(
            <InlineActionButton
                {...baseProps}
                actionId=''
            />,
        );

        await userEvent.click(screen.getByRole('button'));

        expect(mockedDoPostActionWithInlineContext).not.toHaveBeenCalled();
    });

    test('aria-label is set only while executing', async () => {
        const {resolve} = setupControllablePromise();

        renderWithContext(<InlineActionButton {...baseProps}/>);
        const button = screen.getByRole('button');

        // Before any click: no aria-label.
        expect(button).not.toHaveAttribute('aria-label');

        await userEvent.click(button);

        // While executing: aria-label equals the formatted executing label.
        expect(button).toHaveAttribute('aria-label', 'Executing...');

        await act(async () => {
            resolve();
        });

        // Back to idle: no aria-label.
        expect(button).not.toHaveAttribute('aria-label');
    });

    test('button re-enables after thunk returns an error result', async () => {
        // The thunk catches network errors internally and returns {error}.
        // Component must still reset executing state — otherwise a failed
        // click would leave the button permanently disabled.
        mockedDoPostActionWithInlineContext.mockImplementation(
            () => (() => Promise.resolve({error: new Error('network down')})) as unknown as ReturnType<typeof doPostActionWithInlineContext>,
        );

        renderWithContext(<InlineActionButton {...baseProps}/>);
        const button = screen.getByRole('button');

        await userEvent.click(button);

        expect(button).not.toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'false');
    });
});
