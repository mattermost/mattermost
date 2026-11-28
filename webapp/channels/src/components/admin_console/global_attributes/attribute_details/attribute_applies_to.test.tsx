// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AttributeAppliesTo from './attribute_applies_to';
import type {ResourceObjectType} from './attribute_applies_to_constants';

import {DEFAULT_CHANNEL_RESOURCE_CONFIG} from '../applies_to/channels';
import useChannelMissingValues from '../applies_to/channels/use_channel_missing_values';

// Isolates this suite from the MM-70717 missing-values fetch -- covered by
// use_channel_missing_values.test.ts and channels_resource_settings.test.tsx.
jest.mock('../applies_to/channels/use_channel_missing_values');

const mockUseChannelMissingValues = jest.mocked(useChannelMissingValues);

describe('AttributeAppliesTo', () => {
    const onAdd = jest.fn();
    const onRemove = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseChannelMissingValues.mockReturnValue({loading: false, failed: false, summary: null, reload: jest.fn()});
    });

    const renderComponent = (props: Partial<React.ComponentProps<typeof AttributeAppliesTo>> = {}) => {
        return renderWithContext(
            <AttributeAppliesTo
                appliesTo={[]}
                onAdd={onAdd}
                onRemove={onRemove}
                channelResource={DEFAULT_CHANNEL_RESOURCE_CONFIG}
                onChannelResourceChange={jest.fn()}
                {...props}
            />,
        );
    };

    it('renders as a Compass AdminPanel with title and subtitle', () => {
        const {container} = renderComponent();

        expect(container.querySelector('#attribute_applies_to.AdminPanel')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Applies to'})).toBeInTheDocument();
        expect(screen.getByText('Resources this attribute applies to, and who can set the value on each.')).toBeInTheDocument();
    });

    it('renders the empty state when appliesTo is empty', () => {
        renderComponent();
        expect(screen.getByTestId('admin.attribute.applies_to.empty')).toBeInTheDocument();
        expect(screen.queryByTestId(/^admin\.attribute\.applies_to\.(user|channel|post)/)).not.toBeInTheDocument();
    });

    it('shows both Add-resource triggers when the empty state is showing', () => {
        renderComponent();
        const header = screen.getByTestId('admin.attribute.applies_to.add--button');
        const inline = screen.getByTestId('admin.attribute.applies_to.add_inline--button');
        expect(header).toBeVisible();
        expect(inline).toBeVisible();
        expect(header).toHaveAccessibleName('Add resource');
        expect(inline).toHaveAccessibleName('Add resource');
        expect(header).toHaveClass('btn-tertiary');
        expect(inline).toHaveClass('btn-primary');
    });

    it('offers exactly the not-yet-selected types, in Users -> Channels -> Posts order', async () => {
        renderComponent({appliesTo: ['channel']});

        expect(screen.getByTestId('admin.attribute.applies_to.add--button')).toHaveClass('btn-tertiary');
        expect(screen.getByTestId('admin.attribute.applies_to.add--button')).toHaveAccessibleName('Add resource');
        expect(screen.getByTestId('admin.attribute.applies_to.add_inline--button')).toHaveClass('btn-tertiary');
        expect(screen.getByTestId('admin.attribute.applies_to.add_inline--button')).toHaveAccessibleName('Add another resource');

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));
        const items = screen.getAllByRole('menuitem');
        expect(items.map((item) => item.textContent)).toEqual(['Users', 'Posts']);
    });

    it('calls onAdd with the correct type when a menu item is selected', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));
        await userEvent.click(screen.getByRole('menuitem', {name: 'Channels'}));

        // A non-checkbox/radio Menu.Item defers onClick until after the
        // menu's close transition completes (menu_item.tsx's addOnClosedListener).
        await waitFor(() => expect(onAdd).toHaveBeenCalledWith('channel'));
    });

    it('renders one row per entry in appliesTo, in insertion order', () => {
        renderComponent({appliesTo: ['post', 'user']});

        const rows = screen.getAllByTestId(/^admin\.attribute\.applies_to\.(user|channel|post)$/);
        expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual(['admin.attribute.applies_to.post', 'admin.attribute.applies_to.user']);
    });

    it('hides both Add-resource triggers entirely once all three types are present', () => {
        renderComponent({appliesTo: ['user', 'channel', 'post'] as ResourceObjectType[]});

        expect(screen.queryByTestId('admin.attribute.applies_to.add--button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('admin.attribute.applies_to.add_inline--button')).not.toBeInTheDocument();
    });

    it('calls onRemove with each row\'s own type, once expanded', async () => {
        renderComponent({appliesTo: ['user', 'channel']});

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.channel.toggle--button'));
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.channel.remove--button'));
        expect(onRemove).toHaveBeenCalledWith('channel');

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));
        expect(onRemove).toHaveBeenCalledWith('user');
    });

    describe('hideAddResource', () => {
        it('hides both Add-resource triggers even when types are still available', () => {
            renderComponent({hideAddResource: true});

            expect(screen.queryByTestId('admin.attribute.applies_to.add--button')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin.attribute.applies_to.add_inline--button')).not.toBeInTheDocument();
        });

        it('hides the inline trigger next to already-applied rows too, not just the empty state', () => {
            renderComponent({appliesTo: ['user'], hideAddResource: true});

            expect(screen.queryByTestId('admin.attribute.applies_to.add_inline--button')).not.toBeInTheDocument();
            expect(screen.getByTestId('admin.attribute.applies_to.user')).toBeInTheDocument();
        });

        it('shows plugin-owned empty-state copy instead of the normal Add-a-resource copy', () => {
            renderComponent({hideAddResource: true});

            expect(screen.getByTestId('admin.attribute.applies_to.empty')).toHaveTextContent("Resources for plugin-managed attributes can't be added here.");
            expect(screen.getByTestId('admin.attribute.applies_to.empty')).not.toHaveTextContent('Add a resource to apply this attribute');
        });

        it('preserves all existing behavior when hideAddResource is false (default)', () => {
            renderComponent();

            expect(screen.getByTestId('admin.attribute.applies_to.add--button')).toBeInTheDocument();
            expect(screen.getByTestId('admin.attribute.applies_to.add_inline--button')).toBeInTheDocument();
            expect(screen.getByTestId('admin.attribute.applies_to.empty')).toHaveTextContent('Add a resource to apply this attribute');
        });
    });

    describe('userWhoCanSetLockedTooltip on the Users row', () => {
        it('locks Who can set the value once the Users row is expanded', async () => {
            renderComponent({appliesTo: ['user'], userWhoCanSetLockedTooltip: 'Managed by SCIM'});
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

            expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set_locked')).toBeInTheDocument();
        });
    });

    describe('blockedTypes', () => {
        it('offers a blocked type as a disabled option carrying its reason, and adds nothing when it is clicked', async () => {
            renderComponent({blockedTypes: {user: 'Name already in use'}});

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));

            const users = screen.getByRole('menuitem', {name: /^Users/});
            expect(users).toHaveAttribute('aria-disabled', 'true');
            expect(users).toHaveTextContent('Name already in use');

            // pointerEventsCheck off so userEvent dispatches the click rather than
            // refusing it over the item's pointer-events: none. The component
            // passes onAdd to every option unconditionally and relies on MUI's
            // `disabled` to swallow the click, so what follows is a statement
            // about the outcome only — choosing a blocked option adds nothing —
            // and not about any guard of this component's own.
            await userEvent.click(users, {pointerEventsCheck: 0});

            // A live Menu.Item defers its onClick until the menu has finished
            // closing, so close the menu before concluding nothing was added.
            await userEvent.keyboard('{Escape}');
            await waitFor(() => expect(screen.queryByRole('menuitem')).not.toBeInTheDocument());
            expect(onAdd).not.toHaveBeenCalled();
        });

        it('leaves a type with no entry enabled, and still adds it', async () => {
            renderComponent({blockedTypes: {user: 'Name already in use'}});

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));

            const channels = screen.getByRole('menuitem', {name: 'Channels'});
            expect(channels).not.toHaveAttribute('aria-disabled', 'true');
            expect(channels).not.toHaveTextContent('Name already in use');

            await userEvent.click(channels);

            await waitFor(() => expect(onAdd).toHaveBeenCalledWith('channel'));
        });
    });

    describe('lockedTooltip on the Channels row', () => {
        it('wraps the toggle in the lock tooltip when lockedTooltip is given', () => {
            renderComponent({appliesTo: ['channel'], lockedTooltip: 'Locked'});

            expect(screen.getByTestId('admin.attribute.applies_to.channel.toggle_locked')).toBeInTheDocument();
        });

        it('renders no lock wrapper when lockedTooltip is not given', () => {
            renderComponent({appliesTo: ['channel']});

            expect(screen.queryByTestId('admin.attribute.applies_to.channel.toggle_locked')).not.toBeInTheDocument();
        });
    });

    describe('removeLockedTooltips', () => {
        it('locks Remove only on the row whose type has a tooltip', async () => {
            renderComponent({appliesTo: ['user', 'channel'], removeLockedTooltips: {user: 'Locked'}});

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            expect(screen.getByTestId('admin.attribute.applies_to.user.remove_locked')).toBeInTheDocument();

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.channel.toggle--button'));
            expect(screen.getByTestId('admin.attribute.applies_to.channel.remove--button')).toBeEnabled();
        });
    });
});
