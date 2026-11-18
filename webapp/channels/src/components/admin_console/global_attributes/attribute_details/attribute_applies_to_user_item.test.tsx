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
        expect(screen.getByTestId('admin.attribute.applies_to.user')).toHaveTextContent('Users');
    });

    it('starts collapsed, with no Remove button and no config controls, and clicking the toggle reveals both controls and Remove', async () => {
        renderComponent();

        expect(screen.queryByTestId('admin.attribute.applies_to.user.body--region')).not.toBeInTheDocument();
        expect(screen.queryByTestId('admin.attribute.applies_to.user.remove--button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton')).not.toBeInTheDocument();
        expect(screen.queryByTestId('admin.attribute.applies_to.user.who_can_set.member--radio')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
        expect(screen.getByTestId('admin.attribute.applies_to.user.remove--button')).toBeVisible();
        expect(screen.getByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton')).toBeVisible();
        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.member--radio')).toBeVisible();

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
        expect(screen.queryByTestId('admin.attribute.applies_to.user.body--region')).not.toBeInTheDocument();
        expect(screen.queryByTestId('admin.attribute.applies_to.user.remove--button')).not.toBeInTheDocument();
    });

    it('Profile display: renders the visibility prop as the pressed segment, and clicking a different one calls onVisibilityChange', async () => {
        const onVisibilityChange = jest.fn();
        renderComponent({visibility: 'when_set', onVisibilityChange});
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

        expect(screen.getByTestId('admin.attribute.applies_to.user.profile_display:when_set--togglebutton')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByTestId('admin.attribute.applies_to.user.profile_display:hidden--togglebutton')).toHaveAttribute('aria-pressed', 'false');

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton'));
        expect(onVisibilityChange).toHaveBeenCalledWith('always');

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.profile_display:hidden--togglebutton'));
        expect(onVisibilityChange).toHaveBeenCalledWith('hidden');
    });

    it('Who can set the value: renders the managed prop as the selected option, shows the static help caption, and calls onManagedChange on selection', async () => {
        const onManagedChange = jest.fn();
        renderComponent({managed: '', onManagedChange});
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.member--radio')).toBeChecked();
        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio')).not.toBeChecked();
        expect(screen.getByText('Choose Member or System Administrator.')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio'));
        expect(onManagedChange).toHaveBeenCalledWith('admin');
    });

    it.each([
        ['ldap' as const, 'AD/LDAP'],
        ['saml' as const, 'SAML'],
    ])('Managed by: names %s as the sync source above the editable settings, and offers nothing to change', async (externalSource, sourceLabel) => {
        renderComponent({externalSource});
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

        const managedBy = screen.getByTestId('admin.attribute.applies_to.user.managed_by--button');
        expect(managedBy).toBeDisabled();
        expect(managedBy).toHaveAccessibleName(`Managed by: ${sourceLabel}. Values are synced from an external source and cannot be changed here.`);

        // Label, value and helper text in one assertion, so dropping or
        // reordering any of the three fails.
        expect(managedBy.closest('.AttributeAppliesToItem__row')).toHaveTextContent(
            new RegExp(`^Managed by${sourceLabel.replace('/', '\\/')}Not editable in Mattermost\\.$`),
        );

        const body = screen.getByTestId('admin.attribute.applies_to.user.body--region');
        expect([...body.querySelectorAll('.AttributeAppliesToItem__label')].map((el) => el.textContent)).toEqual([
            'Managed by',
            'Profile display',
            'Who can set the value',
        ]);

        // No chevron: the value can never change, so the control must not
        // advertise a menu the way a merely-unavailable select does.
        expect(managedBy.querySelector('.icon-chevron-down')).toBeNull();

        await userEvent.click(managedBy);
        expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
    });

    it('Managed by: omits the row entirely for an attribute with no external source', async () => {
        renderComponent();
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

        expect(screen.queryByTestId('admin.attribute.applies_to.user.managed_by--button')).not.toBeInTheDocument();
        expect(screen.queryByText('Managed by')).not.toBeInTheDocument();
        expect(screen.queryByText('Not editable in Mattermost.')).not.toBeInTheDocument();
    });

    it('Managed by: leaves the editable settings untouched, so a synced attribute still configures its own display and permission', async () => {
        const onVisibilityChange = jest.fn();
        const onManagedChange = jest.fn();
        renderComponent({externalSource: 'ldap', visibility: 'when_set', onVisibilityChange, managed: '', onManagedChange});
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton'));
        expect(onVisibilityChange).toHaveBeenCalledWith('always');

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio'));
        expect(onManagedChange).toHaveBeenCalledWith('admin');
    });

    it('disables both config controls when disabled, once expanded', async () => {
        const {rerender} = renderComponent();
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
        rerender(
            <AttributeAppliesToUserItem
                onRemove={onRemove}
                disabled={true}
            />,
        );

        expect(screen.getByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton')).toBeDisabled();
        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.member--radio')).toBeDisabled();
        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio')).toBeDisabled();
    });

    it('calls onRemove exactly once when Remove is clicked, once expanded', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));
        expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('disables the toggle, and the Remove button once expanded', async () => {
        const {rerender} = renderComponent();

        // Expand while enabled, then disable -- isOpen is local state, so it survives
        // the prop change, letting Remove's own disabled state be asserted directly.
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
        const disabledProps = {onRemove, disabled: true};
        rerender(<AttributeAppliesToUserItem {...disabledProps}/>);

        expect(screen.getByTestId('admin.attribute.applies_to.user.toggle--button')).toBeDisabled();
        expect(screen.getByTestId('admin.attribute.applies_to.user.remove--button')).toBeDisabled();
    });

    it('wraps the toggle in a tooltip explaining the lock reason when lockedTooltip is provided, and omits the wrap otherwise', () => {
        const {rerender} = renderComponent({disabled: true, lockedTooltip: 'Managed by a plugin'});
        expect(screen.getByTestId('admin.attribute.applies_to.user.toggle_locked')).toBeInTheDocument();

        rerender(
            <AttributeAppliesToUserItem
                onRemove={onRemove}
                disabled={true}
            />,
        );
        expect(screen.queryByTestId('admin.attribute.applies_to.user.toggle_locked')).not.toBeInTheDocument();
    });

    it('whoCanSetLockedTooltip locks only Who can set the value, at its stored value, behind a tooltip wrap', async () => {
        const onManagedChange = jest.fn();
        const onVisibilityChange = jest.fn();
        renderComponent({whoCanSetLockedTooltip: 'Managed by SCIM', managed: 'admin', onManagedChange, onVisibilityChange});
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set_locked')).toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.member--radio')).toBeDisabled();
        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio')).toBeDisabled();
        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio')).toBeChecked();

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.member--radio'));
        expect(onManagedChange).not.toHaveBeenCalled();

        expect(screen.getByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton')).toBeEnabled();
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton'));
        expect(onVisibilityChange).toHaveBeenCalledWith('always');
        expect(screen.getByTestId('admin.attribute.applies_to.user.remove--button')).toBeEnabled();
    });

    it('removeLockedTooltip locks only Remove behind a tooltip wrap', async () => {
        const onVisibilityChange = jest.fn();
        renderComponent({removeLockedTooltip: 'Managed by SCIM', onVisibilityChange});
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

        expect(screen.getByTestId('admin.attribute.applies_to.user.remove_locked')).toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.applies_to.user.remove--button')).toBeDisabled();
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));
        expect(onRemove).not.toHaveBeenCalled();

        expect(screen.getByTestId('admin.attribute.applies_to.user.toggle--button')).toBeEnabled();
        expect(screen.queryByTestId('admin.attribute.applies_to.user.toggle_locked')).not.toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton')).toBeEnabled();
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton'));
        expect(onVisibilityChange).toHaveBeenCalledWith('always');
        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.member--radio')).toBeEnabled();
        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio')).toBeEnabled();
    });

    it('renders no Remove lock wrap and enables Remove without removeLockedTooltip', async () => {
        renderComponent();
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

        expect(screen.queryByTestId('admin.attribute.applies_to.user.remove_locked')).not.toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.applies_to.user.remove--button')).toBeEnabled();
    });

    it('renders no Who can set the value lock wrap and enables the radios without whoCanSetLockedTooltip', async () => {
        renderComponent();
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

        expect(screen.queryByTestId('admin.attribute.applies_to.user.who_can_set_locked')).not.toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.member--radio')).toBeEnabled();
        expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio')).toBeEnabled();
    });

    it('makes no Client4 calls and no data-mutating dispatch', async () => {
        const createPropertyField = jest.spyOn(Client4, 'createPropertyField');
        const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

        renderComponent();
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));

        expect(createPropertyField).not.toHaveBeenCalled();
        expect(deletePropertyField).not.toHaveBeenCalled();
    });
});
