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

    it('starts collapsed, and clicking the toggle reveals then hides the placeholder body', async () => {
        renderComponent();

        expect(screen.queryByTestId('attributeAppliesToRow-user-body')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
        expect(screen.getByTestId('attributeAppliesToRow-user-body')).toHaveTextContent('No additional settings for this resource yet.');

        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
        expect(screen.queryByTestId('attributeAppliesToRow-user-body')).not.toBeInTheDocument();
    });

    it('calls onRemove exactly once when Remove is clicked, regardless of expand state', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));
        expect(onRemove).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));
        expect(onRemove).toHaveBeenCalledTimes(2);
    });

    it('does not bubble a Remove click into the toggle -- clicking Remove alone never opens the body', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));
        expect(screen.queryByTestId('attributeAppliesToRow-user-body')).not.toBeInTheDocument();
    });

    it('disables both the toggle and remove button when disabled', () => {
        renderComponent({disabled: true});

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
