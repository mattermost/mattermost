// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import AttributeSelectorMenu from './attribute_selector_menu';

// Real groups carry UUIDs distinct from their names, and session attributes are
// identified by their `session` object type rather than the group id.
const CPA_GROUP_UUID = 'custom_profile_attributes';
const SESSION_GROUP_UUID = 'session_attributes';

const userField: UserPropertyField = {
    id: 'f1',
    name: 'department',
    type: 'text',
    group_id: CPA_GROUP_UUID,
    target_id: '',
    target_type: '',
    object_type: 'user',
    attrs: {
        sort_order: 0,
        visibility: 'always',
        value_type: '',
        managed: 'admin',
        display_name: 'Department',
    },
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
};

const sessionField = {
    id: 'f2',
    name: 'ip_address',
    type: 'text',
    group_id: SESSION_GROUP_UUID,
    target_id: '',
    target_type: 'system',
    object_type: 'session',
    attrs: {
        sort_order: 0,
        visibility: 'always',
        value_type: '',
        display_name: 'IP address',
        platforms: ['desktop', 'mobile'],
    },
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
} as unknown as UserPropertyField;

describe('AttributeSelectorMenu', () => {
    const baseProps = {
        currentAttribute: '',
        disabled: false,
        onChange: jest.fn(),
        menuId: 'attributeMenu',
        buttonId: 'attributeButton',
        enableUserManagedAttributes: false,
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders a Session attributes section with the session option when both groups are present', () => {
        renderWithContext(
            <AttributeSelectorMenu
                {...baseProps}
                availableAttributes={[userField, sessionField]}
            />,
        );

        fireEvent.click(screen.getByTestId('attributeSelectorMenuButton'));

        expect(screen.getByText('Session attributes')).toBeInTheDocument();
        expect(screen.getByText('Department')).toBeInTheDocument();
        expect(screen.getByText('IP address')).toBeInTheDocument();
    });

    test('keeps the session option selectable even when user-managed attributes are disabled', () => {
        renderWithContext(
            <AttributeSelectorMenu
                {...baseProps}
                enableUserManagedAttributes={false}
                availableAttributes={[userField, sessionField]}
            />,
        );

        fireEvent.click(screen.getByTestId('attributeSelectorMenuButton'));

        const sessionItem = document.getElementById('attribute-f2');
        expect(sessionItem).toBeInTheDocument();
        expect(sessionItem).not.toHaveClass('Mui-disabled');
        expect(sessionItem).not.toHaveAttribute('aria-disabled', 'true');

        fireEvent.click(sessionItem as HTMLElement);
        expect(baseProps.onChange).toHaveBeenCalledWith('f2');
    });

    test('does not render the Session attributes header when no session attributes are present', () => {
        renderWithContext(
            <AttributeSelectorMenu
                {...baseProps}
                availableAttributes={[userField]}
            />,
        );

        fireEvent.click(screen.getByTestId('attributeSelectorMenuButton'));

        expect(screen.queryByText('Session attributes')).not.toBeInTheDocument();
        expect(screen.getByText('Department')).toBeInTheDocument();
    });

    test('applies the search filter across both groups', () => {
        renderWithContext(
            <AttributeSelectorMenu
                {...baseProps}
                availableAttributes={[userField, sessionField]}
            />,
        );

        fireEvent.click(screen.getByTestId('attributeSelectorMenuButton'));

        const search = screen.getByRole('textbox');
        fireEvent.change(search, {target: {value: 'ip'}});

        expect(screen.getByText('Session attributes')).toBeInTheDocument();
        expect(screen.getByText('IP address')).toBeInTheDocument();
        expect(screen.queryByText('Department')).not.toBeInTheDocument();
    });

    test('does not render a leading separator when search filters out all user options but keeps a session option', () => {
        renderWithContext(
            <AttributeSelectorMenu
                {...baseProps}
                availableAttributes={[userField, sessionField]}
            />,
        );

        fireEvent.click(screen.getByTestId('attributeSelectorMenuButton'));

        const search = screen.getByRole('textbox');
        fireEvent.change(search, {target: {value: 'ip'}});

        expect(document.querySelector('.MuiDivider-root')).not.toBeInTheDocument();
        expect(screen.getByText('Session attributes')).toBeInTheDocument();
        expect(screen.getByText('IP address')).toBeInTheDocument();
        expect(screen.queryByText('Department')).not.toBeInTheDocument();
    });

    test('renders the separator only when both user and session options are present', () => {
        renderWithContext(
            <AttributeSelectorMenu
                {...baseProps}
                availableAttributes={[userField, sessionField]}
            />,
        );

        fireEvent.click(screen.getByTestId('attributeSelectorMenuButton'));

        expect(document.querySelector('.MuiDivider-root')).toBeInTheDocument();
    });
});
