// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    act,
    renderWithContext,
    screen,
    userEvent,
} from 'tests/react_testing_utils';

import {WithTestMenuContext} from './menu_context_test';
import {MenuItem} from './menu_item';

/**
 * Wraps MenuItem in the minimal context required for handleClick to work:
 * a MenuContext with a close function and a handleClosed callback.
 * Uses WithTestMenuContext (from menu_context_test.tsx) which mirrors
 * the real menu's open/close + onClosedListeners lifecycle.
 */
function renderMenuItem(props: React.ComponentProps<typeof MenuItem>) {
    return renderWithContext(
        <WithTestMenuContext>
            <MenuItem {...props}/>
        </WithTestMenuContext>,
    );
}

describe('MenuItem — onClick deduplication and invocation', () => {
    /**
     * Regression test for the double-fire bug: MUI ButtonBase dispatches
     * both onKeyDown and onClick for the same native Enter keydown event.
     * The lastHandledEventRef deduplication should ensure onClick fires once.
     *
     * We use disableCloseOnSelect so onClick is called immediately (not deferred
     * via addOnClosedListener), making the assertion synchronous.
     */
    it('pressing Enter fires onClick exactly once (deduplication regression)', async () => {
        const onClick = jest.fn();
        renderMenuItem({
            labels: <span>{'Item'}</span>,
            onClick,
            disableCloseOnSelect: true,
        });

        const item = screen.getByRole('menuitem');
        act(() => item.focus());

        await userEvent.keyboard('{enter}');

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('clicking the item fires onClick exactly once', async () => {
        const onClick = jest.fn();
        renderMenuItem({
            labels: <span>{'Item'}</span>,
            onClick,
            disableCloseOnSelect: true,
        });

        await userEvent.click(screen.getByRole('menuitem'));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('pressing Space fires onClick exactly once', async () => {
        const onClick = jest.fn();
        renderMenuItem({
            labels: <span>{'Item'}</span>,
            onClick,
            disableCloseOnSelect: true,
        });

        const item = screen.getByRole('menuitem');
        act(() => item.focus());

        await userEvent.keyboard(' ');

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    /**
     * When disableCloseOnSelect is true the menu stays open and onClick must
     * be called immediately (not queued via addOnClosedListener).
     */
    it('fires onClick immediately when disableCloseOnSelect is true', async () => {
        const onClick = jest.fn();
        renderMenuItem({
            labels: <span>{'Item'}</span>,
            onClick,
            disableCloseOnSelect: true,
        });

        await userEvent.click(screen.getByRole('menuitem'));

        // No waiting required — onClick fires synchronously in this path
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not fire onClick when the item has no onClick prop', async () => {
        // Sanity check: no crash and nothing unexpected fires
        renderMenuItem({
            labels: <span>{'No handler'}</span>,
            disableCloseOnSelect: true,
        });

        await userEvent.click(screen.getByRole('menuitem'));

        // No assertion needed beyond no crash — but we verify the item rendered
        expect(screen.getByRole('menuitem')).toBeInTheDocument();
    });

    it('does not fire onClick on a right-click (non-primary mouse button)', async () => {
        const onClick = jest.fn();
        renderMenuItem({
            labels: <span>{'Item'}</span>,
            onClick,
            disableCloseOnSelect: true,
        });

        // pointer options: button 2 = right mouse button
        await userEvent.pointer({
            target: screen.getByRole('menuitem'),
            keys: '[MouseRight]',
        });

        expect(onClick).not.toHaveBeenCalled();
    });
});
