// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AppsFormActionButton from './apps_form_action_button';

// executeDialogAction returns a thunk (ActionFuncAsync). The component calls
// dispatch(executeDialogAction(url, context)) and awaits the result.
// We model this by having the mock return a function that dispatch will call
// and whose return value is the resolved value of the await.
const mockExecuteDialogAction = jest.fn();

jest.mock('actions/integration_actions', () => ({
    executeDialogAction: (...args: unknown[]) => mockExecuteDialogAction(...args),
}));

describe('AppsFormActionButton', () => {
    const url = 'https://example.com/action';
    const context = {channelId: 'ch1', teamId: 'tm1'};
    const label = 'Run Action';

    beforeEach(() => {
        mockExecuteDialogAction.mockReset();
    });

    it('renders the label text on the button', () => {
        mockExecuteDialogAction.mockReturnValue(() => Promise.resolve({data: {}}));

        renderWithContext(
            <AppsFormActionButton
                label={label}
                url={url}
            />,
        );

        expect(screen.getByRole('button', {name: label})).toBeVisible();
    });

    it('invokes executeDialogAction with (url, context) when clicked', async () => {
        mockExecuteDialogAction.mockReturnValue(() => Promise.resolve({data: {}}));

        renderWithContext(
            <AppsFormActionButton
                label={label}
                url={url}
                context={context}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: label}));

        expect(mockExecuteDialogAction).toHaveBeenCalledTimes(1);
        expect(mockExecuteDialogAction).toHaveBeenCalledWith(url, context);
    });

    it('shows loading state (disabled, aria-busy, loading label) while the dispatch is pending', async () => {
        // Use a promise we can hold open so the in-flight state is observable.
        let resolveAction!: (v: unknown) => void;
        const pendingPromise = new Promise((res) => {
            resolveAction = res;
        });
        mockExecuteDialogAction.mockReturnValue(() => pendingPromise);

        renderWithContext(
            <AppsFormActionButton
                label={label}
                url={url}
            />,
        );

        const button = screen.getByRole('button', {name: label});

        // Kick off the click (do NOT await — we want the in-flight state).
        const clickPromise = userEvent.click(button);

        // The component sets loading=true synchronously before the await, so by the
        // time the next tick runs the button should already be in loading state.
        await waitFor(() => {
            expect(screen.getByRole('button')).toBeDisabled();
        });

        expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByRole('button')).toHaveTextContent('Loading...');

        // Resolve so the component can finish and we don't leak async state.
        resolveAction({data: {}});
        await clickPromise;
    });

    it('is disabled when url is empty and does not dispatch on click', async () => {
        mockExecuteDialogAction.mockReturnValue(() => Promise.resolve({data: {}}));

        renderWithContext(
            <AppsFormActionButton
                label={label}
                url=''
            />,
        );

        const button = screen.getByRole('button', {name: label});
        expect(button).toBeDisabled();

        // userEvent.click on a disabled button is a no-op, but let's verify no dispatch happened.
        await userEvent.click(button);
        expect(mockExecuteDialogAction).not.toHaveBeenCalled();
    });

    it('shows an error alert when the thunk resolves with {error: ...}', async () => {
        mockExecuteDialogAction.mockReturnValue(() =>
            Promise.resolve({error: {message: 'Something went wrong'}}),
        );

        renderWithContext(
            <AppsFormActionButton
                label={label}
                url={url}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: label}));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeVisible();
        });

        expect(screen.getByRole('alert')).toHaveTextContent('Action failed');
    });

    it('shows an error alert when the thunk throws (catch branch)', async () => {
        mockExecuteDialogAction.mockReturnValue(() =>
            Promise.reject(new Error('network error')),
        );

        renderWithContext(
            <AppsFormActionButton
                label={label}
                url={url}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: label}));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeVisible();
        });

        expect(screen.getByRole('alert')).toHaveTextContent('Action failed');
    });

    it('does not throw or warn about setState on an unmounted component when unmounted mid-request', async () => {
        // Capture console.error so we can assert nothing related to unmounted updates fires.
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        let resolveAction!: (v: unknown) => void;
        const pendingPromise = new Promise((res) => {
            resolveAction = res;
        });
        mockExecuteDialogAction.mockReturnValue(() => pendingPromise);

        const {unmount} = renderWithContext(
            <AppsFormActionButton
                label={label}
                url={url}
            />,
        );

        // Start the click but don't await it yet.
        const clickPromise = userEvent.click(screen.getByRole('button', {name: label}));

        // Wait until loading state is set (confirming the request is in-flight).
        await waitFor(() => {
            expect(screen.getByRole('button')).toBeDisabled();
        });

        // Unmount while the request is still in flight.
        unmount();

        // Now resolve the pending action — the mountedRef guard should prevent any setState.
        resolveAction({data: {}});
        await clickPromise;

        // No React "Can't perform a state update on an unmounted component" errors.
        const unmountedErrors = consoleError.mock.calls.filter((args) =>
            args.some((a) => typeof a === 'string' && a.includes('unmounted')),
        );
        expect(unmountedErrors).toHaveLength(0);

        consoleError.mockRestore();
    });

    it('does not setState on an unmounted component when the request REJECTS mid-request (catch-path guard)', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        let rejectAction!: (e: unknown) => void;
        const pendingPromise = new Promise((_res, rej) => {
            rejectAction = rej;
        });
        mockExecuteDialogAction.mockReturnValue(() => pendingPromise);

        const {unmount} = renderWithContext(
            <AppsFormActionButton
                label={label}
                url={url}
            />,
        );

        const clickPromise = userEvent.click(screen.getByRole('button', {name: label}));

        await waitFor(() => {
            expect(screen.getByRole('button')).toBeDisabled();
        });

        // Unmount while in flight, then reject — the catch branch's mountedRef
        // guard must prevent setError on the unmounted component.
        unmount();
        rejectAction(new Error('network error'));
        await clickPromise;

        const unmountedErrors = consoleError.mock.calls.filter((args) =>
            args.some((a) => typeof a === 'string' && a.includes('unmounted')),
        );
        expect(unmountedErrors).toHaveLength(0);

        consoleError.mockRestore();
    });
});
