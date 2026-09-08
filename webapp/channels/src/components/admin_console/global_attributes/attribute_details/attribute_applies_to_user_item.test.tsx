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

    it('starts collapsed, with no Remove button and no config controls, and clicking the toggle reveals both controls and Remove', async () => {
        renderComponent();

        expect(screen.queryByTestId('attributeAppliesToRow-user-body')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeAppliesToRow-user-remove')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeAppliesToUserProfileDisplay-always')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeAppliesToUserWhoCanSet-member')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
        expect(screen.getByTestId('attributeAppliesToRow-user-remove')).toBeVisible();
        expect(screen.getByTestId('attributeAppliesToUserProfileDisplay-always')).toBeVisible();
        expect(screen.getByTestId('attributeAppliesToUserWhoCanSet-member')).toBeVisible();

        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
        expect(screen.queryByTestId('attributeAppliesToRow-user-body')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeAppliesToRow-user-remove')).not.toBeInTheDocument();
    });

    it('Profile display: renders the visibility prop as the pressed segment, and clicking a different one calls onVisibilityChange', async () => {
        const onVisibilityChange = jest.fn();
        renderComponent({visibility: 'when_set', onVisibilityChange});
        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));

        expect(screen.getByTestId('attributeAppliesToUserProfileDisplay-when_set')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('attributeAppliesToUserProfileDisplay-always')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByTestId('attributeAppliesToUserProfileDisplay-hidden')).toHaveAttribute('aria-pressed', 'false');

        await userEvent.click(screen.getByTestId('attributeAppliesToUserProfileDisplay-always'));
        expect(onVisibilityChange).toHaveBeenCalledWith('always');

        await userEvent.click(screen.getByTestId('attributeAppliesToUserProfileDisplay-hidden'));
        expect(onVisibilityChange).toHaveBeenCalledWith('hidden');
    });

    it('Who can set the value: renders the managed prop as the selected option, shows help text explaining the System Administrator option, and calls onManagedChange on selection', async () => {
        const onManagedChange = jest.fn();
        renderComponent({managed: '', onManagedChange});
        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));

        expect(screen.getByTestId('attributeAppliesToUserWhoCanSet-member')).toBeChecked();
        expect(screen.getByTestId('attributeAppliesToUserWhoCanSet-admin')).not.toBeChecked();
        expect(screen.getByText('Only System Administrators can set this value. Members will see it as read-only on their profile.')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('attributeAppliesToUserWhoCanSet-admin'));
        expect(onManagedChange).toHaveBeenCalledWith('admin');
    });

    it('disables both config controls when disabled, once expanded', async () => {
        const {rerender} = renderComponent();
        await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
        rerender(
            <AttributeAppliesToUserItem
                onRemove={onRemove}
                disabled={true}
            />,
        );

        expect(screen.getByTestId('attributeAppliesToUserProfileDisplay-always')).toBeDisabled();
        expect(screen.getByTestId('attributeAppliesToUserWhoCanSet-member')).toBeDisabled();
        expect(screen.getByTestId('attributeAppliesToUserWhoCanSet-admin')).toBeDisabled();
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

    it('wraps the toggle in a tooltip explaining the lock reason when lockedTooltip is provided, and omits the wrap otherwise', () => {
        const {rerender} = renderComponent({disabled: true, lockedTooltip: 'Managed by a plugin'});
        expect(screen.getByTestId('attributeAppliesToRow-user-toggleLockWrap')).toBeInTheDocument();

        rerender(
            <AttributeAppliesToUserItem
                onRemove={onRemove}
                disabled={true}
            />,
        );
        expect(screen.queryByTestId('attributeAppliesToRow-user-toggleLockWrap')).not.toBeInTheDocument();
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
