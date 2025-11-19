// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';
import type {Channel} from '@mattermost/types/channels';
import type {UserPropertyField, FieldVisibility, FieldValueType} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelLevelAccessRules from './channel_level_access_rules';

// Mock the TableEditor component
jest.mock('components/admin_console/access_control/editors/table_editor/table_editor', () => {
    return function MockTableEditor(props: any) {
        return (
            <div data-testid='table-editor'>
                <input
                    data-testid='expression-input'
                    value={props.value}
                    onChange={(e) => props.onChange(e.target.value)}
                />
            </div>
        );
    };
});

// Mock the confirm modal
jest.mock('../../../../channel_settings_modal/channel_access_rules_confirm_modal', () => {
    return function MockChannelAccessRulesConfirmModal() {
        return <div data-testid='confirm-modal'/>;
    };
});

// Mock Redux selectors with stable references
const mockAccessControlSettings = {
    EnableAttributeBasedAccessControl: true,
    EnableChannelScopeAccessControl: true,
    EnableUserManagedAttributes: true,
};

jest.mock('mattermost-redux/selectors/entities/access_control', () => ({
    getAccessControlSettings: jest.fn(() => mockAccessControlSettings),
}));

// Mock the hooks
jest.mock('hooks/useChannelAccessControlActions', () => {
    return {
        useChannelAccessControlActions: () => ({
            getAccessControlFields: jest.fn().mockResolvedValue({data: []}),
            getVisualAST: jest.fn().mockResolvedValue({data: {}}),
            searchUsers: jest.fn().mockResolvedValue({data: {users: []}}),
            validateExpressionAgainstRequester: jest.fn().mockResolvedValue({data: {requester_matches: true}}),
        }),
    };
});

describe('ChannelLevelAccessRules', () => {
    const mockChannel: Channel = TestHelper.getChannelMock({
        id: 'test-channel-id',
        display_name: 'Test Channel',
        name: 'test-channel',
        type: 'P',
    });

    const mockParentPolicies: AccessControlPolicy[] = [
        {
            id: 'policy-1',
            name: 'Test Policy',
            type: 'parent',
            rules: [{expression: 'user.department == "Engineering"'}],
        },
    ];

    const mockUserAttributes: UserPropertyField[] = [
        {
            id: 'attr-1',
            group_id: 'custom_profile_attributes' as const,
            name: 'department',
            type: 'text' as const,
            attrs: {
                sort_order: 1,
                visibility: 'always' as FieldVisibility,
                value_type: '' as FieldValueType,
                ldap: 'department',
            },
            create_at: 1000,
            update_at: 1000,
            delete_at: 0,
        },
        {
            id: 'attr-2',
            group_id: 'custom_profile_attributes' as const,
            name: 'role',
            type: 'text' as const,
            attrs: {
                sort_order: 2,
                visibility: 'always' as FieldVisibility,
                value_type: '' as FieldValueType,
                managed: 'admin',
            },
            create_at: 1000,
            update_at: 1000,
            delete_at: 0,
        },
    ];

    const defaultProps = {
        channel: mockChannel,
        parentPolicies: mockParentPolicies,
        userAttributes: mockUserAttributes,
        onRulesChange: jest.fn(),
        initialExpression: '',
        initialAutoSync: false,
        isDisabled: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render the component with correct title and subtitle', () => {
        renderWithContext(<ChannelLevelAccessRules {...defaultProps}/>);

        expect(screen.getByText('Channel-Specific Access Rules')).toBeInTheDocument();
        expect(screen.getByText(/Define additional rules specific to this channel/)).toBeInTheDocument();
    });

    it('should render the TableEditor when attributes are loaded', async () => {
        renderWithContext(<ChannelLevelAccessRules {...defaultProps}/>);

        // Wait for the component to load attributes
        await screen.findByTestId('table-editor');

        expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        expect(screen.getByTestId('expression-input')).toBeInTheDocument();
    });

    it('should call onRulesChange when expression changes', async () => {
        const onRulesChange = jest.fn();
        renderWithContext(
            <ChannelLevelAccessRules
                {...defaultProps}
                onRulesChange={onRulesChange}
            />,
        );

        // Wait for the component to load attributes
        const expressionInput = await screen.findByTestId('expression-input');

        // Change the expression
        await userEvent.type(expressionInput, 'user.role == "admin"');

        // Should call onRulesChange with hasChanges=true
        expect(onRulesChange).toHaveBeenCalledWith(
            true, // hasChanges
            'user.role == "admin"', // expression
            false, // autoSync
        );
    });

    it('should show auto-sync checkbox when expression is not empty', async () => {
        renderWithContext(
            <ChannelLevelAccessRules
                {...defaultProps}
                initialExpression='user.department == "Engineering"'
            />,
        );

        // Wait for the component to load
        await screen.findByTestId('table-editor');

        expect(screen.getByText('Auto-add members based on access rules')).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should render table editor with expression', async () => {
        renderWithContext(
            <ChannelLevelAccessRules
                {...defaultProps}
                initialExpression='user.department == "Engineering"'
            />,
        );

        // Wait for the component to load
        await screen.findByTestId('table-editor');
        const expressionInput = screen.getByTestId('expression-input');

        expect(expressionInput).toHaveValue('user.department == "Engineering"');
    });

    it('should call onRulesChange when auto-sync checkbox is toggled', async () => {
        const onRulesChange = jest.fn();
        renderWithContext(
            <ChannelLevelAccessRules
                {...defaultProps}
                onRulesChange={onRulesChange}
                initialExpression='user.department == "Engineering"'
            />,
        );

        // Wait for the component to load
        await screen.findByTestId('table-editor');

        const autoSyncCheckbox = screen.getByRole('checkbox');
        await userEvent.click(autoSyncCheckbox);

        // Should call onRulesChange with autoSync=true
        expect(onRulesChange).toHaveBeenCalledWith(
            true, // hasChanges
            'user.department == "Engineering"', // expression
            true, // autoSync
        );
    });

    it('should initialize with provided initial values', () => {
        renderWithContext(
            <ChannelLevelAccessRules
                {...defaultProps}
                initialExpression='user.role == "admin"'
                initialAutoSync={true}
            />,
        );

        // Component should initialize with the provided values
        // The onRulesChange should be called with hasChanges=false initially
        expect(defaultProps.onRulesChange).toHaveBeenCalledWith(
            false, // hasChanges (should be false initially)
            'user.role == "admin"', // expression
            true, // autoSync
        );
    });

    it('should be disabled when isDisabled prop is true', async () => {
        renderWithContext(
            <ChannelLevelAccessRules
                {...defaultProps}
                isDisabled={true}
                initialExpression='user.department == "Engineering"'
            />,
        );

        // Wait for the component to load
        await screen.findByTestId('table-editor');

        const autoSyncCheckbox = screen.getByRole('checkbox');
        expect(autoSyncCheckbox).toBeDisabled();
    });

    it('should not show auto-sync and test sections when expression is empty', async () => {
        renderWithContext(<ChannelLevelAccessRules {...defaultProps}/>);

        // Wait for the component to load
        await screen.findByTestId('table-editor');

        // Auto-sync section should not be visible
        expect(screen.queryByText('Auto-add members based on access rules')).not.toBeInTheDocument();
        expect(screen.queryByText('Test access rules')).not.toBeInTheDocument();
    });
});
