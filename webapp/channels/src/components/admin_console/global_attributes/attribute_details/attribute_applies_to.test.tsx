// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AttributeAppliesTo from './attribute_applies_to';
import type {ResourceObjectType} from './attribute_applies_to_constants';

describe('AttributeAppliesTo', () => {
    const onAdd = jest.fn();
    const onRemove = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const renderComponent = (props: Partial<React.ComponentProps<typeof AttributeAppliesTo>> = {}) => {
        return renderWithContext(
            <AttributeAppliesTo
                appliesTo={[]}
                onAdd={onAdd}
                onRemove={onRemove}
                {...props}
            />,
        );
    };

    it('renders the empty state when appliesTo is empty', () => {
        renderComponent();
        expect(screen.getByTestId('attributeAppliesToEmptyState')).toBeInTheDocument();
        expect(screen.queryByTestId(/attributeAppliesToRow-/)).not.toBeInTheDocument();
    });

    it('shows both Add-resource triggers with distinct accessible names when the empty state is showing', () => {
        renderComponent();
        const header = screen.getByTestId('attributeAppliesToAddResourceButtonHeader');
        const inline = screen.getByTestId('attributeAppliesToAddResourceButtonInline');
        expect(header).toBeVisible();
        expect(inline).toBeVisible();
        expect(header).toHaveAccessibleName('Add resource');
        expect(inline).toHaveAccessibleName('Add another resource');
    });

    it('offers exactly the not-yet-selected types, in Users -> Channels -> Posts order', async () => {
        renderComponent({appliesTo: ['channel']});

        await userEvent.click(screen.getByTestId('attributeAppliesToAddResourceButtonHeader'));
        const items = screen.getAllByRole('menuitem');
        expect(items.map((item) => item.textContent)).toEqual(['Users', 'Posts']);
    });

    it('calls onAdd with the correct type when a menu item is selected', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('attributeAppliesToAddResourceButtonHeader'));
        await userEvent.click(screen.getByRole('menuitem', {name: 'Channels'}));

        // A non-checkbox/radio Menu.Item defers onClick until after the
        // menu's close transition completes (menu_item.tsx's addOnClosedListener).
        await waitFor(() => expect(onAdd).toHaveBeenCalledWith('channel'));
    });

    it('renders one row per entry in appliesTo, in insertion order', () => {
        renderComponent({appliesTo: ['post', 'user']});

        const rows = screen.getAllByTestId(/^attributeAppliesToRow-(user|channel|post)$/);
        expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual(['attributeAppliesToRow-post', 'attributeAppliesToRow-user']);
    });

    it('hides both Add-resource triggers entirely once all three types are present', () => {
        renderComponent({appliesTo: ['user', 'channel', 'post'] as ResourceObjectType[]});

        expect(screen.queryByTestId('attributeAppliesToAddResourceButtonHeader')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeAppliesToAddResourceButtonInline')).not.toBeInTheDocument();
    });

    it('calls onRemove with each row\'s own type, once expanded', async () => {
        renderComponent({appliesTo: ['user', 'channel']});

        await userEvent.click(screen.getByTestId('attributeAppliesToRow-channel-toggle'));
        await userEvent.click(screen.getByTestId('attributeAppliesToRow-channel-remove'));
        expect(onRemove).toHaveBeenCalledWith('channel');

        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));
        expect(onRemove).toHaveBeenCalledWith('user');
    });
});
