// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {FieldVisibility, FieldValueType} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {Team} from '@mattermost/types/teams';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamLevelAccessRules from './team_level_access_rules';

jest.mock('components/admin_console/access_control/editors/table_editor/table_editor', () => {
    return function MockTableEditor(props: any) {
        return (
            <div data-testid='table-editor'>
                <input
                    data-testid='expression-input'
                    value={props.value}
                    onChange={(e) => props.onChange(e.target.value)}
                />
                <button
                    data-testid='trigger-parse-error'
                    onClick={() => props.onParseError('Invalid expression syntax')}
                />
            </div>
        );
    };
});

const mockAccessControlSettings = {
    EnableAttributeBasedAccessControl: true,
    EnableUserManagedAttributes: true,
};

jest.mock('mattermost-redux/selectors/entities/access_control', () => ({
    getAccessControlSettings: jest.fn(() => mockAccessControlSettings),
}));

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

describe('TeamLevelAccessRules', () => {
    const mockTeam: Team = TestHelper.getTeamMock({
        id: 'test-team-id',
        display_name: 'Test Team',
        name: 'test-team',
    });

    const mockUserAttributes: UserPropertyField[] = [
        {
            id: 'attr-1',
            group_id: 'custom_profile_attributes' as const,
            name: 'department',
            type: 'text' as const,
            create_at: 1000,
            update_at: 1000,
            delete_at: 0,
            created_by: '',
            updated_by: '',
            target_id: '',
            target_type: '',
            object_type: '',
            attrs: {
                sort_order: 1,
                visibility: 'always' as FieldVisibility,
                value_type: '' as FieldValueType,
                ldap: 'department',
            },
        },
    ];

    const defaultProps = {
        team: mockTeam,
        userAttributes: mockUserAttributes,
        onRulesChange: jest.fn(),
        initialExpression: '',
        initialAutoSync: false,
        isDisabled: false,
    };

    it('should render the component with correct title and subtitle', () => {
        renderWithContext(<TeamLevelAccessRules {...defaultProps}/>);

        expect(screen.getByText('Custom access rules')).toBeInTheDocument();
        expect(screen.getByText('User attributes and values as additional rules to restrict team membership')).toBeInTheDocument();
    });

    it('should render the TableEditor', async () => {
        renderWithContext(<TeamLevelAccessRules {...defaultProps}/>);

        await screen.findByTestId('table-editor');

        expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        expect(screen.getByTestId('expression-input')).toBeInTheDocument();
    });

    it('should call onRulesChange when expression changes', async () => {
        const onRulesChange = jest.fn();
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                onRulesChange={onRulesChange}
            />,
        );

        const expressionInput = await screen.findByTestId('expression-input');

        await userEvent.type(expressionInput, 'user.role == "admin"');

        expect(onRulesChange).toHaveBeenCalledWith(
            true,
            'user.role == "admin"',
            false,
        );
    });

    it('should always show auto-sync checkbox regardless of expression', async () => {
        renderWithContext(<TeamLevelAccessRules {...defaultProps}/>);

        await screen.findByTestId('table-editor');

        expect(screen.getByText('Auto-add members based on access rules')).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should disable auto-sync checkbox when expression is empty', async () => {
        renderWithContext(<TeamLevelAccessRules {...defaultProps}/>);

        await screen.findByTestId('table-editor');

        expect(screen.getByRole('checkbox')).toBeDisabled();
    });

    it('should enable auto-sync checkbox when expression is not empty', async () => {
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                initialExpression='user.department == "Engineering"'
            />,
        );

        await screen.findByTestId('table-editor');

        expect(screen.getByRole('checkbox')).not.toBeDisabled();
    });

    it('should render table editor with expression', async () => {
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                initialExpression='user.department == "Engineering"'
            />,
        );

        await screen.findByTestId('table-editor');
        const expressionInput = screen.getByTestId('expression-input');

        expect(expressionInput).toHaveValue('user.department == "Engineering"');
    });

    it('should call onRulesChange when auto-sync checkbox is toggled', async () => {
        const onRulesChange = jest.fn();
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                onRulesChange={onRulesChange}
                initialExpression='user.department == "Engineering"'
            />,
        );

        await screen.findByTestId('table-editor');

        const autoSyncCheckbox = screen.getByRole('checkbox');
        await userEvent.click(autoSyncCheckbox);

        expect(onRulesChange).toHaveBeenCalledWith(
            true,
            'user.department == "Engineering"',
            true,
        );
    });

    it('should initialize with provided initial values', () => {
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                initialExpression='user.role == "admin"'
                initialAutoSync={true}
            />,
        );

        expect(defaultProps.onRulesChange).toHaveBeenCalledWith(
            false,
            'user.role == "admin"',
            true,
        );
    });

    it('should reset auto-sync to false when expression is cleared', async () => {
        const onRulesChange = jest.fn();
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                onRulesChange={onRulesChange}
                initialExpression='user.department == "Engineering"'
                initialAutoSync={true}
            />,
        );

        await screen.findByTestId('table-editor');

        const expressionInput = screen.getByTestId('expression-input');
        await userEvent.clear(expressionInput);

        expect(onRulesChange).toHaveBeenCalledWith(
            expect.any(Boolean),
            '',
            false,
        );
    });

    it('should be disabled when isDisabled prop is true', async () => {
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                isDisabled={true}
                initialExpression='user.department == "Engineering"'
            />,
        );

        await screen.findByTestId('table-editor');

        const autoSyncCheckbox = screen.getByRole('checkbox');
        expect(autoSyncCheckbox).toBeDisabled();
    });

    it('should show auto-sync section even when expression is empty, with disabled description', async () => {
        renderWithContext(<TeamLevelAccessRules {...defaultProps}/>);

        await screen.findByTestId('table-editor');

        expect(screen.getByText('Auto-add members based on access rules')).toBeInTheDocument();
        expect(screen.getByText('Access rules will restrict who can join the team, but qualifying users will not be added automatically.')).toBeInTheDocument();
    });

    it('should show enabled description when auto-sync is on', async () => {
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                initialExpression='user.department == "Engineering"'
                initialAutoSync={true}
            />,
        );

        await screen.findByTestId('table-editor');

        expect(screen.getByText('Qualifying users are automatically added as members, and members who no longer match will be removed.')).toBeInTheDocument();
    });

    it('should display a form error when the editor reports a parse error', async () => {
        renderWithContext(<TeamLevelAccessRules {...defaultProps}/>);

        await screen.findByTestId('table-editor');

        await userEvent.click(screen.getByTestId('trigger-parse-error'));

        expect(screen.getByText('Invalid expression syntax')).toBeInTheDocument();
    });
});
