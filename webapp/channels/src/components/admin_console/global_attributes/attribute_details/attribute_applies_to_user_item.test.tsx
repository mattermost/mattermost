// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AttributeAppliesToUserItem from './attribute_applies_to_user_item';

describe('AttributeAppliesToUserItem', () => {
    const onRemove = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const renderComponent = (props: Partial<React.ComponentProps<typeof AttributeAppliesToUserItem>> = {}) => {
        return renderWithContext(
            <AttributeAppliesToUserItem
                onRemove={onRemove}
                {...props}
            />,
        );
    };

    it('renders the Users label', () => {
        renderComponent();
        expect(screen.getByTestId('attributeAppliesToRow-user')).toHaveTextContent('Users');
    });

    it('starts collapsed, with no Remove button, and clicking the toggle reveals the placeholder body and Remove', async () => {
        renderComponent();

        expect(screen.queryByTestId('attributeAppliesToRow-user-body')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeAppliesToRow-user-remove')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
        expect(screen.getByTestId('attributeAppliesToRow-user-body')).toHaveTextContent('No additional settings for this resource yet.');
        expect(screen.getByTestId('attributeAppliesToRow-user-remove')).toBeVisible();

        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
        expect(screen.queryByTestId('attributeAppliesToRow-user-body')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeAppliesToRow-user-remove')).not.toBeInTheDocument();
    });

    it('calls onRemove exactly once when Remove is clicked, once expanded', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));
        expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('disables the toggle, and the Remove button once expanded', async () => {
        const {rerender} = renderComponent();

        // Expand while enabled, then disable -- isOpen is local state, so it survives
        // the prop change, letting Remove's own disabled state be asserted directly.
        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
        const disabledProps = {onRemove, disabled: true};
        rerender(<AttributeAppliesToUserItem {...disabledProps}/>);

        expect(screen.getByTestId('attributeAppliesToRow-user-toggle')).toBeDisabled();
        expect(screen.getByTestId('attributeAppliesToRow-user-remove')).toBeDisabled();
    });

    it('makes no Client4 calls and no data-mutating dispatch', async () => {
        const createPropertyField = jest.spyOn(Client4, 'createPropertyField');
        const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

        renderComponent();
        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));

        expect(createPropertyField).not.toHaveBeenCalled();
        expect(deletePropertyField).not.toHaveBeenCalled();
    });
});
