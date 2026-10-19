// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {doPostActionWithCookie} from 'mattermost-redux/actions/posts';

import {act, fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {applyIntegrationGotoLocation} from 'utils/integration_navigation';

import InlineActionButton from './index';

jest.mock('mattermost-redux/actions/posts', () => ({
    doPostActionWithCookie: jest.fn(),
}));

jest.mock('utils/integration_navigation', () => ({
    applyIntegrationGotoLocation: jest.fn(),
}));

const mockedDoPostActionWithCookie = doPostActionWithCookie as jest.MockedFunction<typeof doPostActionWithCookie>;
const mockedApplyIntegrationGotoLocation = applyIntegrationGotoLocation as jest.MockedFunction<typeof applyIntegrationGotoLocation>;

/**
 * Creates a thunk-shaped mock whose inner promise is externally controllable.
 * The thunk returned by `doPostActionWithCookie` is invoked by redux-thunk
 * middleware; the returned promise is what the component awaits.
 */
function setupControllablePromise() {
    let resolveFn: (value: unknown) => void = () => {};
    const promise = new Promise((resolve) => {
        resolveFn = resolve;
    });

    mockedDoPostActionWithCookie.mockImplementation(() => {
        return (() => promise) as unknown as ReturnType<typeof doPostActionWithCookie>;
    });

    return {promise, resolve: () => resolveFn({data: {}})};
}

describe('InlineActionButton', () => {
    const baseProps = {
        href: 'mmaction://mx?tail=214&mds=C130J',
        postId: 'abc',
        children: 'Click me',
    };

    beforeEach(() => {
        mockedDoPostActionWithCookie.mockReset();
        mockedApplyIntegrationGotoLocation.mockReset();
    });

    test('renders with children as button label', () => {
        mockedDoPostActionWithCookie.mockImplementation(
            () => (() => Promise.resolve({data: {}})) as unknown as ReturnType<typeof doPostActionWithCookie>,
        );

        renderWithContext(<InlineActionButton {...baseProps}/>);

        const button = screen.getByRole('button');
        expect(button).toBeVisible();
        expect(button).toHaveTextContent('Click me');
    });

    test('dispatches thunk with parsed action ID and query on click', async () => {
        const {resolve} = setupControllablePromise();

        renderWithContext(<InlineActionButton {...baseProps}/>);

        await userEvent.click(screen.getByRole('button'));

        expect(mockedDoPostActionWithCookie).toHaveBeenCalledTimes(1);
        expect(mockedDoPostActionWithCookie).toHaveBeenCalledWith('abc', 'mx', '', '', {tail: '214', mds: 'C130J'}, 'mm_block');

        // Resolve pending dispatch inside act so the trailing setState commits cleanly.
        await act(async () => {
            resolve();
        });
    });

    test('href without query results in empty query', async () => {
        const {resolve} = setupControllablePromise();

        renderWithContext(
            <InlineActionButton
                {...baseProps}
                href='mmaction://mx'
            />,
        );

        await userEvent.click(screen.getByRole('button'));

        expect(mockedDoPostActionWithCookie).toHaveBeenCalledTimes(1);
        expect(mockedDoPostActionWithCookie).toHaveBeenCalledWith('abc', 'mx', '', '', {}, 'mm_block');

        await act(async () => {
            resolve();
        });
    });

    test('mixed-case action ID is preserved (URL.hostname would lowercase it)', async () => {
        const {resolve} = setupControllablePromise();

        renderWithContext(
            <InlineActionButton
                {...baseProps}
                href='mmaction://MxPlan42?tail=214'
            />,
        );

        await userEvent.click(screen.getByRole('button'));

        // Server action ID regex allows [A-Za-z0-9_-]+; losing case would
        // cause lookups to 404 when mm_blocks_actions keys are mixed-case.
        expect(mockedDoPostActionWithCookie).toHaveBeenCalledWith('abc', 'MxPlan42', '', '', {tail: '214'}, 'mm_block');

        await act(async () => {
            resolve();
        });
    });

    test('double-click prevented by ref guard', async () => {
        // Use a never-resolving promise so the first dispatch stays in-flight.
        mockedDoPostActionWithCookie.mockImplementation(
            () => (() => new Promise(() => {})) as unknown as ReturnType<typeof doPostActionWithCookie>,
        );

        renderWithContext(<InlineActionButton {...baseProps}/>);
        const button = screen.getByRole('button');

        // Fire two synchronous clicks before any microtask can run.
        // fireEvent.click invokes the handler synchronously; the ref guard
        // must block the second invocation before setState re-render lands.
        fireEvent.click(button);
        fireEvent.click(button);

        expect(mockedDoPostActionWithCookie).toHaveBeenCalledTimes(1);

        // Let any pending microtasks settle so teardown is clean. The dispatch
        // promise never resolves, which is fine — we only care about the guard.
        await act(async () => {
            await Promise.resolve();
        });
    });

    test('button uses aria-disabled (not native disabled) while executing — keeps it focusable for screen readers', async () => {
        const {resolve} = setupControllablePromise();

        renderWithContext(<InlineActionButton {...baseProps}/>);
        const button = screen.getByRole('button');

        await userEvent.click(button);

        // Native `disabled` would remove the button from tab order; use
        // aria-disabled so keyboard / screen-reader users can still
        // navigate to it and hear "executing" announced via aria-busy.
        // WCAG 2.1.1 + 4.1.3.
        expect(button).not.toBeDisabled();
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).toHaveAttribute('aria-busy', 'true');

        await act(async () => {
            resolve();
        });

        // Idle state omits aria-disabled and aria-busy entirely (using
        // {executing || undefined} idiom) so screen readers don't
        // announce "not busy" / "not disabled" superfluously.
        expect(button).not.toBeDisabled();
        expect(button).not.toHaveAttribute('aria-disabled');
        expect(button).not.toHaveAttribute('aria-busy');
    });

    test('ref guard no-ops repeat clicks while aria-disabled (no native disabled to suppress)', async () => {
        // Without native `disabled`, the browser fires onClick on
        // aria-disabled buttons. The component's executingRef guard must
        // catch the second click and no-op.
        mockedDoPostActionWithCookie.mockImplementation(
            () => (() => new Promise(() => {})) as unknown as ReturnType<typeof doPostActionWithCookie>,
        );

        renderWithContext(<InlineActionButton {...baseProps}/>);
        const button = screen.getByRole('button');

        fireEvent.click(button);
        fireEvent.click(button);

        expect(mockedDoPostActionWithCookie).toHaveBeenCalledTimes(1);

        await act(async () => {
            await Promise.resolve();
        });
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

    test('renders {children} as plain text when postId is empty', () => {
        const {container} = renderWithContext(
            <InlineActionButton
                {...baseProps}
                postId=''
            />,
        );

        // No button is rendered; the link body shows as plain text instead
        // so the user sees something readable rather than a broken affordance.
        expect(screen.queryByRole('button')).toBeNull();
        expect(container).toHaveTextContent('Click me');
    });

    test('renders {children} as plain text when href has wrong scheme', () => {
        const {container} = renderWithContext(
            <InlineActionButton
                {...baseProps}
                href='https://example.com/hook'
            />,
        );

        expect(screen.queryByRole('button')).toBeNull();
        expect(container).toHaveTextContent('Click me');
    });

    test('renders {children} as plain text for opaque mmaction: URI (no //)', () => {
        // getScheme()-style accept of "mmaction:foo" without "//" would
        // mis-slice the authority. Component must reject and fall back.
        const {container} = renderWithContext(
            <InlineActionButton
                {...baseProps}
                href='mmaction:MxPlan42'
            />,
        );

        expect(screen.queryByRole('button')).toBeNull();
        expect(container).toHaveTextContent('Click me');
    });

    test.each([
        {href: 'mmaction://my-plan?x=1', actionId: 'my-plan', query: {x: '1'}},
        {href: 'mmaction://foo_bar', actionId: 'foo_bar', query: {}},
        {href: 'mmaction://pw_mm_blocks_openurl_eph', actionId: 'pw_mm_blocks_openurl_eph', query: {}},
    ])('accepts action ID $actionId and dispatches on click', async ({href, actionId, query}) => {
        const {resolve} = setupControllablePromise();

        renderWithContext(
            <InlineActionButton
                {...baseProps}
                href={href}
            />,
        );

        await userEvent.click(screen.getByRole('button'));

        expect(mockedDoPostActionWithCookie).toHaveBeenCalledWith('abc', actionId, '', '', query, 'mm_block');

        await act(async () => {
            resolve();
        });
    });

    test('renders {children} as plain text for invalid action ID', () => {
        // Server regex is ^[A-Za-z0-9_-]+$; URL authority punctuation and
        // other characters would never resolve server-side.
        for (const href of [
            'mmaction://plan:443',
            'mmaction://user@plan',
            'mmaction://my.plan',
            'mmaction://my plan',
            'mmaction://',
        ]) {
            const {container, unmount} = renderWithContext(
                <InlineActionButton
                    {...baseProps}
                    href={href}
                />,
            );
            expect(screen.queryByRole('button')).toBeNull();
            expect(container).toHaveTextContent('Click me');
            unmount();
        }
    });

    test('renders {children} as plain text when params exceed length cap', () => {
        // 2049-char query string is over MAX_PARAMS_LENGTH (2048).
        const {container} = renderWithContext(
            <InlineActionButton
                {...baseProps}
                href={`mmaction://mx?k=${'x'.repeat(2047)}`}
            />,
        );

        expect(screen.queryByRole('button')).toBeNull();
        expect(container).toHaveTextContent('Click me');
    });

    test('aria-label without label prop: idle has none (children carries the name), executing has executing-label', async () => {
        const {resolve} = setupControllablePromise();

        renderWithContext(<InlineActionButton {...baseProps}/>);
        const button = screen.getByRole('button');

        // Idle, no label prop: accessible name comes from {children}.
        expect(button).not.toHaveAttribute('aria-label');

        await userEvent.click(button);

        expect(button).toHaveAttribute('aria-label', 'Executing...');

        await act(async () => {
            resolve();
        });

        expect(button).not.toHaveAttribute('aria-label');
    });

    test('aria-label uses label prop at idle (icon-only callers must pass it)', async () => {
        const {resolve} = setupControllablePromise();

        renderWithContext(
            <InlineActionButton
                {...baseProps}
                label='Refresh fleet status'
            >
                <i
                    className='icon-refresh'
                    aria-hidden='true'
                />
            </InlineActionButton>,
        );
        const button = screen.getByRole('button');

        // Idle with label prop: aria-label provides the accessible name
        // even when children is icon-only. WCAG 4.1.2.
        expect(button).toHaveAttribute('aria-label', 'Refresh fleet status');

        await userEvent.click(button);

        // While executing: executing-label takes precedence so users hear
        // status feedback rather than the static button name.
        expect(button).toHaveAttribute('aria-label', 'Executing...');

        await act(async () => {
            resolve();
        });

        // Back to idle: aria-label restored to the label prop.
        expect(button).toHaveAttribute('aria-label', 'Refresh fleet status');
    });

    test('button re-enables and shows inline error after thunk returns an error result', async () => {
        // The thunk catches network errors internally and returns {error}.
        // Component must still reset executing state, AND surface the error
        // inline (matching the MessageAttachment.handleAction pattern) so
        // the user has feedback on a failed click — the thunk's logError
        // call is silent in production.
        mockedDoPostActionWithCookie.mockImplementation(
            () => (() => Promise.resolve({error: new Error('network down')})) as unknown as ReturnType<typeof doPostActionWithCookie>,
        );

        renderWithContext(<InlineActionButton {...baseProps}/>);
        const button = screen.getByRole('button');

        await userEvent.click(button);

        expect(button).not.toBeDisabled();
        expect(button).not.toHaveAttribute('aria-busy');
        expect(screen.getByText('network down')).toBeVisible();
    });

    test('falls back to default action_failed message when thunk error has no message', async () => {
        mockedDoPostActionWithCookie.mockImplementation(
            () => (() => Promise.resolve({error: {}})) as unknown as ReturnType<typeof doPostActionWithCookie>,
        );

        renderWithContext(<InlineActionButton {...baseProps}/>);

        await userEvent.click(screen.getByRole('button'));

        expect(screen.getByText('Action failed to execute')).toBeVisible();
    });

    test('clears prior error on next click', async () => {
        mockedDoPostActionWithCookie.mockImplementationOnce(
            () => (() => Promise.resolve({error: new Error('first failure')})) as unknown as ReturnType<typeof doPostActionWithCookie>,
        );

        renderWithContext(<InlineActionButton {...baseProps}/>);
        const button = screen.getByRole('button');

        await userEvent.click(button);
        expect(screen.getByText('first failure')).toBeVisible();

        // Second click resolves successfully — prior error must clear.
        mockedDoPostActionWithCookie.mockImplementationOnce(
            () => (() => Promise.resolve({data: {}})) as unknown as ReturnType<typeof doPostActionWithCookie>,
        );
        await userEvent.click(button);

        expect(screen.queryByText('first failure')).toBeNull();
    });

    test('shows timeout error when dispatch hangs longer than INLINE_ACTION_TIMEOUT_MS', async () => {
        // Dispatch never resolves — only the client-side timeout can win
        // the race.
        mockedDoPostActionWithCookie.mockImplementation(
            () => (() => new Promise(() => {})) as unknown as ReturnType<typeof doPostActionWithCookie>,
        );

        jest.useFakeTimers();
        try {
            renderWithContext(<InlineActionButton {...baseProps}/>);
            const button = screen.getByRole('button');

            fireEvent.click(button);

            // Advance past the 15s client-side timeout. Wrap in act so
            // the trailing setState (error rendering + state reset) is
            // flushed.
            await act(async () => {
                jest.advanceTimersByTime(15_001);
            });

            expect(screen.getByText('Action timed out. Try again.')).toBeVisible();
            expect(button).not.toBeDisabled();
            expect(button).not.toHaveAttribute('aria-busy');
        } finally {
            jest.useRealTimers();
        }
    });

    test('uses doPostActionWithCookie when mmBlocksActionCookie is set and applies goto_location from response', async () => {
        const gotoLocation = '/some-location';
        mockedDoPostActionWithCookie.mockImplementation(
            () => (() => Promise.resolve({data: {goto_location: gotoLocation}})) as unknown as ReturnType<typeof doPostActionWithCookie>,
        );

        renderWithContext(
            <InlineActionButton
                {...baseProps}
                mmBlocksActionCookie='encrypted-cookie'
                integrationFormat='mm_block'
            />,
        );

        await userEvent.click(screen.getByRole('button'));

        expect(mockedDoPostActionWithCookie).toHaveBeenCalledTimes(1);
        expect(mockedDoPostActionWithCookie).toHaveBeenCalledWith(
            'abc',
            'mx',
            'encrypted-cookie',
            '',
            {tail: '214', mds: 'C130J'},
            'mm_block',
        );
        expect(mockedApplyIntegrationGotoLocation).toHaveBeenCalledTimes(1);
        expect(mockedApplyIntegrationGotoLocation).toHaveBeenCalledWith(gotoLocation);
    });
});
