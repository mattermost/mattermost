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
    const actual = jest.requireActual('components/admin_console/access_control/editors/table_editor/table_editor');
    return {
        __esModule: true,
        ...actual,
        default: function MockTableEditor(props: any) {
            return (
                <div
                    data-testid='table-editor'
                    data-team-id={props.teamId ?? ''}
                    data-attrs={JSON.stringify(props.userAttributes.map((a: UserPropertyField) => a.name))}
                >
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
        },
    };
});

jest.mock('components/admin_console/access_control/editors/cel_editor/editor', () => {
    return function MockCELEditor(props: any) {
        return (
            <div
                data-testid='cel-editor'
                data-has-masked={String(props.hasMaskedRows)}
                data-disabled={String(Boolean(props.disabled))}
                data-team-id={props.teamId ?? ''}
                data-resource-attrs={JSON.stringify(props.resourceAttributes ?? null)}
                data-attrs={JSON.stringify(props.userAttributes)}
            >
                <input
                    data-testid='cel-input'
                    value={props.value}
                    onChange={(e) => props.onChange(e.target.value)}
                />
                <button
                    data-testid='cel-valid'
                    onClick={() => props.onValidate(true)}
                />
                <button
                    data-testid='cel-invalid'
                    onClick={() => props.onValidate(false)}
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

        expect(screen.getByText('Team-specific membership rules')).toBeInTheDocument();
        expect(screen.getByText('User attributes and values as additional rules to restrict team membership')).toBeInTheDocument();
    });

    it('does not scope the access-rule test to team members (no teamId passed to the editor)', async () => {
        renderWithContext(<TeamLevelAccessRules {...defaultProps}/>);

        const editor = await screen.findByTestId('table-editor');

        // teamId would scope "Test access rule" (and its count) to current team members;
        // it must preview everyone who matches, workspace-wide, like the policy editor.
        expect(editor).toHaveAttribute('data-team-id', '');
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
                initialExpression='user.attributes.department == "Engineering"'
            />,
        );

        await screen.findByTestId('table-editor');

        expect(screen.getByRole('checkbox')).not.toBeDisabled();
    });

    it('should render table editor with expression', async () => {
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                initialExpression='user.attributes.department == "Engineering"'
            />,
        );

        await screen.findByTestId('table-editor');
        const expressionInput = screen.getByTestId('expression-input');

        expect(expressionInput).toHaveValue('user.attributes.department == "Engineering"');
    });

    it('should call onRulesChange when auto-sync checkbox is toggled', async () => {
        const onRulesChange = jest.fn();
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                onRulesChange={onRulesChange}
                initialExpression='user.attributes.department == "Engineering"'
            />,
        );

        await screen.findByTestId('table-editor');

        const autoSyncCheckbox = screen.getByRole('checkbox');
        await userEvent.click(autoSyncCheckbox);

        expect(onRulesChange).toHaveBeenCalledWith(
            true,
            'user.attributes.department == "Engineering"',
            true,
        );
    });

    it('should initialize with provided initial values', () => {
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                initialExpression='user.attributes.role == "admin"'
                initialAutoSync={true}
            />,
        );

        expect(defaultProps.onRulesChange).toHaveBeenCalledWith(
            false,
            'user.attributes.role == "admin"',
            true,
        );
    });

    it('should reset auto-sync to false when expression is cleared', async () => {
        const onRulesChange = jest.fn();
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                onRulesChange={onRulesChange}
                initialExpression='user.attributes.department == "Engineering"'
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
                initialExpression='user.attributes.department == "Engineering"'
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
                initialExpression='user.attributes.department == "Engineering"'
                initialAutoSync={true}
            />,
        );

        await screen.findByTestId('table-editor');

        expect(screen.getByText('Qualifying users are automatically added as members, and members who no longer match will be removed.')).toBeInTheDocument();
    });

    it('should switch to the advanced editor when the table editor reports a parse error', async () => {
        renderWithContext(<TeamLevelAccessRules {...defaultProps}/>);

        await screen.findByTestId('table-editor');

        await userEvent.click(screen.getByTestId('trigger-parse-error'));

        expect(screen.getByTestId('cel-editor')).toBeInTheDocument();
        expect(screen.queryByText('Invalid expression syntax')).not.toBeInTheDocument();
    });

    it('should show the error inline without switching modes when there are no attributes', async () => {
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                userAttributes={[]}
            />,
        );

        await screen.findByTestId('table-editor');

        await userEvent.click(screen.getByTestId('trigger-parse-error'));

        expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        expect(screen.queryByTestId('cel-editor')).not.toBeInTheDocument();
        expect(screen.getByText('Invalid expression syntax')).toBeInTheDocument();
    });

    it('should enable auto-sync checkbox for a parent-governed team even with no custom expression', async () => {
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                initialExpression=''
                hasParentPolicies={true}
            />,
        );

        await screen.findByTestId('table-editor');

        expect(screen.getByRole('checkbox')).not.toBeDisabled();
    });

    it('should call onRulesChange with autoSync when toggled on a parent-only team', async () => {
        const onRulesChange = jest.fn();
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                onRulesChange={onRulesChange}
                initialExpression=''
                hasParentPolicies={true}
            />,
        );

        await screen.findByTestId('table-editor');

        await userEvent.click(screen.getByRole('checkbox'));

        expect(onRulesChange).toHaveBeenCalledWith(true, '', true);
    });

    it('should keep auto-sync checkbox disabled when neither a custom expression nor a parent policy exists', async () => {
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                initialExpression=''
                hasParentPolicies={false}
            />,
        );

        await screen.findByTestId('table-editor');

        expect(screen.getByRole('checkbox')).toBeDisabled();
    });

    it('should disable auto-sync when isDisabled is true even if a parent policy governs the team', async () => {
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                isDisabled={true}
                initialExpression=''
                hasParentPolicies={true}
            />,
        );

        await screen.findByTestId('table-editor');

        expect(screen.getByRole('checkbox')).toBeDisabled();
    });

    it('should reset auto-sync to false when the last parent policy is removed and no custom rule remains', async () => {
        const onRulesChange = jest.fn();
        const {rerender} = renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                onRulesChange={onRulesChange}
                initialExpression=''
                initialAutoSync={true}
                hasParentPolicies={true}
            />,
        );

        await screen.findByTestId('table-editor');
        expect(screen.getByRole('checkbox')).toBeChecked();

        // Unlinking the last parent leaves nothing to govern membership.
        rerender(
            <TeamLevelAccessRules
                {...defaultProps}
                onRulesChange={onRulesChange}
                initialExpression=''
                initialAutoSync={true}
                hasParentPolicies={false}
            />,
        );

        expect(screen.getByRole('checkbox')).not.toBeChecked();
        expect(onRulesChange).toHaveBeenLastCalledWith(true, '', false);
    });

    it('keeps a persisted auto-sync checked when parent policies arrive after the auto-sync flag (staggered load)', async () => {
        // fetchAccessControlPolicies commits the child policy's active flag and its
        // parent imports in two separate network round-trips: initialAutoSync lands
        // first, hasParentPolicies second. The empty-expression reset effect must not
        // zero a persisted auto-sync during that window.
        const {rerender} = renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                initialExpression=''
                initialAutoSync={false}
                hasParentPolicies={false}
            />,
        );

        await screen.findByTestId('table-editor');

        // Commit 1: child.active (true) arrives; parents not yet loaded.
        rerender(
            <TeamLevelAccessRules
                {...defaultProps}
                initialExpression=''
                initialAutoSync={true}
                hasParentPolicies={false}
            />,
        );

        // Commit 2: parent imports arrive.
        rerender(
            <TeamLevelAccessRules
                {...defaultProps}
                initialExpression=''
                initialAutoSync={true}
                hasParentPolicies={true}
            />,
        );

        expect(screen.getByRole('checkbox')).toBeChecked();
        expect(screen.getByRole('checkbox')).toBeEnabled();
    });

    it('removing the only rule clears it and turns auto-add off, reporting the change to the parent', async () => {
        // A stateful parent that echoes reported values back as initial props, the way
        // team_details persists them into its own state (stable onRulesChange). Exercises
        // the full remove-the-only-rule path through that round-trip.
        const reported: Array<{expression: string; autoSync: boolean}> = [];
        const Harness = () => {
            const [expr, setExpr] = React.useState('');
            const [autoSync, setAutoSync] = React.useState(false);

            // Staggered load: the rule + auto-add arrive after mount, like fetchAccessControlPolicies.
            React.useEffect(() => {
                setExpr('user.attributes.Department == "Engineering"');
                setAutoSync(true);
            }, []);

            const onRulesChange = React.useCallback((_h: boolean, e: string, a: boolean) => {
                reported.push({expression: e, autoSync: a});
                setExpr(e);
                setAutoSync(a);
            }, []);

            return (
                <TeamLevelAccessRules
                    team={mockTeam}
                    userAttributes={mockUserAttributes}
                    onRulesChange={onRulesChange}
                    initialExpression={expr}
                    initialAutoSync={autoSync}
                    hasParentPolicies={false}
                />
            );
        };

        renderWithContext(<Harness/>);
        await screen.findByTestId('table-editor');

        // Auto-add loaded on with the rule present.
        expect(screen.getByRole('checkbox')).toBeChecked();

        // Remove the only rule.
        await userEvent.clear(screen.getByTestId('expression-input'));

        // Rule is gone, auto-add turns off and its checkbox is disabled (nothing to sync),
        // and the parent was told the expression is empty with auto-add off.
        expect(screen.getByTestId('expression-input')).toHaveValue('');
        expect(screen.getByRole('checkbox')).not.toBeChecked();
        expect(screen.getByRole('checkbox')).toBeDisabled();
        expect(reported[reported.length - 1]).toEqual({expression: '', autoSync: false});
    });

    it('should not reset auto-sync to false for a parent-only team when the expression is empty', () => {
        const onRulesChange = jest.fn();
        renderWithContext(
            <TeamLevelAccessRules
                {...defaultProps}
                onRulesChange={onRulesChange}
                initialExpression=''
                initialAutoSync={true}
                hasParentPolicies={true}
            />,
        );

        // A parent policy alone is enough to govern membership, so the empty-expression
        // reset effect must not clear the auto-add flag.
        expect(onRulesChange).toHaveBeenLastCalledWith(false, '', true);
    });

    describe('editor mode', () => {
        const simpleExpression = 'user.attributes.department == "Engineering"';
        const complexExpression = 'user.attributes.A == "x" || user.attributes.B == "y"';

        const sessionField: UserPropertyField = {
            ...mockUserAttributes[0],
            id: 'attr-session',
            group_id: 'session_attributes',
            name: 'ip_address',
            target_type: 'system',
            object_type: 'session',
        };

        const unmanagedField: UserPropertyField = {
            ...mockUserAttributes[0],
            id: 'attr-unmanaged',
            name: 'nickname',
            attrs: {
                sort_order: 1,
                visibility: 'always' as FieldVisibility,
                value_type: '' as FieldValueType,
            },
        };

        afterEach(() => {
            mockAccessControlSettings.EnableUserManagedAttributes = true;
        });

        const getToggle = () => screen.getByTestId('team-rules-editor-mode-toggle');

        test('defaults to the table editor with a switch to advanced button', () => {
            renderWithContext(<TeamLevelAccessRules {...defaultProps}/>);

            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            expect(screen.queryByTestId('cel-editor')).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Switch to Advanced Mode'})).toBeEnabled();
        });

        test('switching to advanced keeps the expression', async () => {
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    initialExpression={simpleExpression}
                />,
            );

            await userEvent.click(getToggle());

            expect(screen.getByTestId('cel-editor')).toBeInTheDocument();
            expect(screen.queryByTestId('table-editor')).not.toBeInTheDocument();
            expect(screen.getByTestId('cel-input')).toHaveValue(simpleExpression);
            expect(getToggle()).toHaveTextContent('Switch to Simple Mode');
        });

        test('opens a complex expression in advanced with simple mode disabled', () => {
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    initialExpression={complexExpression}
                />,
            );

            expect(screen.getByTestId('cel-editor')).toBeInTheDocument();
            expect(getToggle()).toHaveTextContent('Switch to Simple Mode');
            expect(getToggle()).toBeDisabled();
        });

        test('shows the complex expression tooltip on the disabled toggle', async () => {
            const user = userEvent.setup({pointerEventsCheck: 0});
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    initialExpression={complexExpression}
                />,
            );

            await user.hover(getToggle());

            expect(await screen.findByText('Complex expression detected. Simple expressions editor is not available at the moment.')).toBeInTheDocument();
        });

        test('a simple expression in advanced can switch back to the table', async () => {
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    initialExpression={simpleExpression}
                />,
            );

            await userEvent.click(getToggle());
            expect(screen.getByTestId('cel-editor')).toBeInTheDocument();
            expect(getToggle()).toBeEnabled();

            await userEvent.click(getToggle());

            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            expect(screen.queryByTestId('cel-editor')).not.toBeInTheDocument();
        });

        test('switches to advanced when a complex expression loads after mount', () => {
            const {rerender} = renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    initialExpression=''
                />,
            );
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();

            rerender(
                <TeamLevelAccessRules
                    {...defaultProps}
                    initialExpression={complexExpression}
                />,
            );

            expect(screen.getByTestId('cel-editor')).toBeInTheDocument();
        });

        test('never downgrades to the table on its own', async () => {
            const {rerender} = renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    initialExpression={complexExpression}
                />,
            );

            await userEvent.clear(screen.getByTestId('cel-input'));
            expect(screen.getByTestId('cel-editor')).toBeInTheDocument();

            // The parent echoes the cleared expression back.
            rerender(
                <TeamLevelAccessRules
                    {...defaultProps}
                    initialExpression=''
                />,
            );
            expect(screen.getByTestId('cel-editor')).toBeInTheDocument();
        });

        test('disables the toggle with a tooltip when no attribute is usable', async () => {
            mockAccessControlSettings.EnableUserManagedAttributes = false;
            const user = userEvent.setup({pointerEventsCheck: 0});
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    userAttributes={[unmanagedField]}
                />,
            );

            expect(getToggle()).toBeDisabled();

            await user.hover(getToggle());

            expect(await screen.findByText('Please configure user attributes to use the editor.')).toBeInTheDocument();
        });

        test('keeps the toggle enabled while attributes are still loading', () => {
            mockAccessControlSettings.EnableUserManagedAttributes = false;
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    userAttributes={[]}
                />,
            );

            expect(getToggle()).toBeEnabled();
        });

        test('shows the error inline without switching modes when no attribute can be added', async () => {
            mockAccessControlSettings.EnableUserManagedAttributes = false;
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    userAttributes={[unmanagedField]}
                />,
            );

            await userEvent.click(screen.getByTestId('trigger-parse-error'));

            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            expect(screen.queryByTestId('cel-editor')).not.toBeInTheDocument();
            expect(screen.getByText('Invalid expression syntax')).toBeInTheDocument();
        });

        test('isDisabled disables the toggle and the advanced editor', () => {
            const {unmount} = renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    isDisabled={true}
                />,
            );
            expect(getToggle()).toBeDisabled();
            unmount();

            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    isDisabled={true}
                    initialExpression={complexExpression}
                />,
            );
            expect(screen.getByTestId('cel-editor')).toHaveAttribute('data-disabled', 'true');
        });

        test('the advanced editor gets no team scope, no resource attributes and no session attributes', async () => {
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    userAttributes={[...mockUserAttributes, sessionField]}
                />,
            );

            await userEvent.click(getToggle());

            const editor = screen.getByTestId('cel-editor');
            expect(editor).toHaveAttribute('data-team-id', '');
            expect(editor).toHaveAttribute('data-resource-attrs', 'null');

            const attrs = JSON.parse(editor.getAttribute('data-attrs')!).map((a: {attribute: string}) => a.attribute);
            expect(attrs).toEqual(['department']);
        });

        test('the table editor gets no session attributes', () => {
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    userAttributes={[...mockUserAttributes, sessionField]}
                />,
            );

            expect(screen.getByTestId('table-editor')).toHaveAttribute('data-attrs', JSON.stringify(['department']));
        });

        test('forwards hasMaskedRows to the advanced editor', () => {
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    initialExpression={complexExpression}
                    hasMaskedRows={true}
                />,
            );

            expect(screen.getByTestId('cel-editor')).toHaveAttribute('data-has-masked', 'true');
        });

        test('rejects resource attribute references', async () => {
            const onValidityChange = jest.fn();
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    onValidityChange={onValidityChange}
                />,
            );

            await userEvent.click(getToggle());
            await userEvent.type(screen.getByTestId('cel-input'), 'resource.attributes.Program == "x"');

            expect(screen.getByRole('alert')).toHaveTextContent('Team membership rules can\'t reference resource attributes.');
            expect(onValidityChange).toHaveBeenLastCalledWith(false);
        });

        test('rejects session attribute references', async () => {
            const onValidityChange = jest.fn();
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    onValidityChange={onValidityChange}
                />,
            );

            await userEvent.click(getToggle());
            await userEvent.type(screen.getByTestId('cel-input'), 'user.session.ip == "1.2.3.4"');

            expect(screen.getByRole('alert')).toHaveTextContent('Team membership rules can\'t reference session attributes.');
            expect(onValidityChange).toHaveBeenLastCalledWith(false);
        });

        test('rejects session attribute references in simple mode too', () => {
            const onValidityChange = jest.fn();
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    initialExpression='user.session.ip == "1.2.3.4"'
                    onValidityChange={onValidityChange}
                />,
            );

            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            expect(screen.getByRole('alert')).toHaveTextContent('Team membership rules can\'t reference session attributes.');
            expect(onValidityChange).toHaveBeenLastCalledWith(false);
        });

        test('reports advanced editor validity and resets it when returning to the table', async () => {
            const onValidityChange = jest.fn();
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    initialExpression={simpleExpression}
                    onValidityChange={onValidityChange}
                />,
            );

            await userEvent.click(getToggle());
            await userEvent.click(screen.getByTestId('cel-invalid'));
            expect(onValidityChange).toHaveBeenLastCalledWith(false);

            await userEvent.click(getToggle());
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            expect(onValidityChange).toHaveBeenLastCalledWith(true);
        });

        test('reports valid on unmount', async () => {
            const onValidityChange = jest.fn();
            const {unmount} = renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    initialExpression={complexExpression}
                    onValidityChange={onValidityChange}
                />,
            );

            await userEvent.click(screen.getByTestId('cel-invalid'));
            expect(onValidityChange).toHaveBeenLastCalledWith(false);

            unmount();

            expect(onValidityChange).toHaveBeenLastCalledWith(true);
        });

        test('advanced edits are reported like table edits', async () => {
            const onRulesChange = jest.fn();
            renderWithContext(
                <TeamLevelAccessRules
                    {...defaultProps}
                    onRulesChange={onRulesChange}
                />,
            );

            await userEvent.click(getToggle());
            await userEvent.type(screen.getByTestId('cel-input'), complexExpression);

            expect(onRulesChange).toHaveBeenLastCalledWith(true, complexExpression, false);
            expect(screen.getByRole('checkbox')).toBeEnabled();
        });

        test('keeps focus on the toggle after switching with the keyboard', async () => {
            renderWithContext(<TeamLevelAccessRules {...defaultProps}/>);

            const toggle = getToggle();
            toggle.focus();
            await userEvent.keyboard('{Enter}');

            expect(screen.getByTestId('cel-editor')).toBeInTheDocument();
            expect(getToggle()).toBe(toggle);
            expect(toggle).toHaveFocus();
        });
    });
});
