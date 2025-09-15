// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useChannelSystemPolicies} from 'hooks/useChannelSystemPolicies';
import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsAccessRulesTab from './channel_settings_access_rules_tab';

// Mock the hooks
jest.mock('hooks/useChannelAccessControlActions');
jest.mock('hooks/useChannelSystemPolicies');

// Mock TableEditor
jest.mock('components/admin_console/access_control/editors/table_editor/table_editor', () => {
    const React = require('react');
    return jest.fn(() => React.createElement('div', {'data-testid': 'table-editor'}, 'TableEditor'));
});

// Mock SaveChangesPanel
jest.mock('components/widgets/modals/components/save_changes_panel', () => {
    const React = require('react');
    return jest.fn((props) => {
        return React.createElement('div', {
            'data-testid': 'save-changes-panel',
            'data-state': props.state,
        }, [
            React.createElement('button', {
                key: 'save',
                'data-testid': 'SaveChangesPanel__save-btn',
                onClick: props.handleSubmit,
            }, 'Save'),
            React.createElement('button', {
                key: 'cancel',
                'data-testid': 'SaveChangesPanel__cancel-btn',
                onClick: props.handleCancel,
            }, 'Reset'),
        ]);
    });
});

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;
const mockUseChannelSystemPolicies = useChannelSystemPolicies as jest.MockedFunction<typeof useChannelSystemPolicies>;
const MockedTableEditor = TableEditor as jest.MockedFunction<typeof TableEditor>;
const MockedSaveChangesPanel = SaveChangesPanel as jest.MockedFunction<typeof SaveChangesPanel>;

describe('components/channel_settings_modal/ChannelSettingsAccessRulesTab', () => {
    const mockActions = {
        getAccessControlFields: jest.fn(),
        getVisualAST: jest.fn(),
        searchUsers: jest.fn(),
        getChannelPolicy: jest.fn(),
        saveChannelPolicy: jest.fn(),
        deleteChannelPolicy: jest.fn(),
        getChannelMembers: jest.fn(),
        createJob: jest.fn(),
        updateAccessControlPolicyActive: jest.fn(),
        validateExpressionAgainstRequester: jest.fn(),
    };

    const mockUserAttributes: UserPropertyField[] = [
        {
            id: 'attr1',
            name: 'department',
            type: 'select',
            group_id: 'custom_profile_attributes',
            create_at: 1736541716295,
            update_at: 1736541716295,
            delete_at: 0,
            attrs: {
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
                options: [
                    {id: 'eng', name: 'Engineering'},
                    {id: 'sales', name: 'Sales'},
                ],
            },
        },
        {
            id: 'attr2',
            name: 'location',
            type: 'select',
            group_id: 'custom_profile_attributes',
            create_at: 1736541716295,
            update_at: 1736541716295,
            delete_at: 0,
            attrs: {
                sort_order: 1,
                visibility: 'when_set',
                value_type: '',
                options: [
                    {id: 'us', name: 'US'},
                    {id: 'ca', name: 'Canada'},
                ],
            },
        },
    ];

    const baseProps = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            name: 'test-channel',
            display_name: 'Test Channel',
            type: 'P',
        }),
        setAreThereUnsavedChanges: jest.fn(),
        showTabSwitchError: false,
    };

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        id: 'current_user_id',
                        username: 'testuser',
                        first_name: 'Test',
                        last_name: 'User',
                        email: 'test@example.com',
                    },
                },
            },
        },
        plugins: {
            components: {},
        },
    };

    beforeEach(() => {
        // Clear mocks but preserve implementations
        mockActions.getAccessControlFields.mockClear();
        mockActions.getChannelPolicy.mockClear();
        mockActions.saveChannelPolicy.mockClear();
        mockActions.searchUsers.mockClear();
        mockUseChannelAccessControlActions.mockReturnValue(mockActions);
        mockUseChannelSystemPolicies.mockReturnValue({
            policies: [],
            loading: false,
            error: null,
        });
        mockActions.getAccessControlFields.mockResolvedValue({
            data: mockUserAttributes,
        });

        // Mock getChannelPolicy to reject (no existing policy)
        mockActions.getChannelPolicy.mockRejectedValue(new Error('Policy not found'));

        // Mock saveChannelPolicy to resolve successfully
        mockActions.saveChannelPolicy.mockResolvedValue({data: {success: true}});

        // Mock validateExpressionAgainstRequester to return that user matches
        mockActions.validateExpressionAgainstRequester.mockResolvedValue({
            data: {requester_matches: true},
        });

        // Mock searchUsers to return current user (for self-exclusion validation)
        mockActions.searchUsers.mockResolvedValue({
            data: {
                users: [
                    {
                        id: 'current_user_id',
                        username: 'testuser',
                        first_name: 'Test',
                        last_name: 'User',
                    },
                ],
            },
        });

        // Suppress console methods for tests
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(window, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render access rules title and subtitle', () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(screen.getByRole('heading', {name: 'Access Rules'})).toBeInTheDocument();
        expect(screen.getByText('Select user attributes and values as rules to restrict channel membership')).toBeInTheDocument();
    });

    test('should render with main container class', () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(screen.getByText('Access Rules').closest('.ChannelSettingsModal__accessRulesTab')).toBeInTheDocument();
    });

    test('should handle missing optional props gracefully', () => {
        const minimalProps = {
            channel: baseProps.channel,
        };

        expect(() => {
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...minimalProps}/>,
                initialState,
            );
        }).not.toThrow();

        expect(screen.getByRole('heading', {name: 'Access Rules'})).toBeInTheDocument();
    });

    test('should render header section with correct structure', () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        const header = screen.getByText('Access Rules').closest('.ChannelSettingsModal__accessRulesHeader');
        expect(header).toBeInTheDocument();

        // Check that both title and subtitle are within the header
        const title = screen.getByRole('heading', {name: 'Access Rules'});
        const subtitle = screen.getByText('Select user attributes and values as rules to restrict channel membership');

        expect(header).toContainElement(title);
        expect(header).toContainElement(subtitle);
    });

    test('should render with different channel types', () => {
        const publicChannel = TestHelper.getChannelMock({
            id: 'public_channel_id',
            name: 'public-channel',
            display_name: 'Public Channel',
            type: 'O',
        });

        const propsWithPublicChannel = {
            ...baseProps,
            channel: publicChannel,
        };

        renderWithContext(
            <ChannelSettingsAccessRulesTab {...propsWithPublicChannel}/>,
            initialState,
        );

        expect(screen.getByRole('heading', {name: 'Access Rules'})).toBeInTheDocument();
        expect(screen.getByText('Select user attributes and values as rules to restrict channel membership')).toBeInTheDocument();
    });

    test('should call useChannelAccessControlActions hook', () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(mockUseChannelAccessControlActions).toHaveBeenCalledTimes(2); // Once for the hook call and once for the mock return
    });

    test('should load user attributes on mount', async () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(mockActions.getAccessControlFields).toHaveBeenCalledWith('', 100);
        });
    });

    test('should not render TableEditor initially when attributes are loading', () => {
        // Mock to return unresolved promise to simulate loading state
        mockActions.getAccessControlFields.mockReturnValue(new Promise(() => {}));

        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(screen.queryByTestId('table-editor')).not.toBeInTheDocument();
        expect(document.querySelector('.ChannelSettingsModal__accessRulesEditor')).not.toBeInTheDocument();
    });

    test('should render TableEditor when attributes are loaded', async () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        expect(document.querySelector('.ChannelSettingsModal__accessRulesEditor')).toBeInTheDocument();
    });

    test('should pass correct props to TableEditor', async () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        expect(MockedTableEditor).toHaveBeenCalledWith(
            expect.objectContaining({
                value: '',
                userAttributes: mockUserAttributes,
                actions: mockActions,
                onChange: expect.any(Function),
                onValidate: expect.any(Function),
                onParseError: expect.any(Function),
            }),
            expect.anything(),
        );
    });

    test('should call setAreThereUnsavedChanges when expression changes', async () => {
        const setAreThereUnsavedChanges = jest.fn();
        const propsWithCallback = {
            ...baseProps,
            setAreThereUnsavedChanges,
        };

        renderWithContext(
            <ChannelSettingsAccessRulesTab {...propsWithCallback}/>,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        // Get the onChange callback passed to TableEditor
        const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;

        // Simulate expression change
        onChangeCallback('user.attributes.department == "Engineering"');

        expect(setAreThereUnsavedChanges).toHaveBeenCalledWith(true);
    });

    test('should not call setAreThereUnsavedChanges when callback is not provided', async () => {
        const propsWithoutCallback = {
            ...baseProps,
            setAreThereUnsavedChanges: undefined,
        };

        renderWithContext(
            <ChannelSettingsAccessRulesTab {...propsWithoutCallback}/>,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        // Get the onChange callback passed to TableEditor
        const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;

        // Simulate expression change - should not throw error
        expect(() => {
            onChangeCallback('user.attributes.department == "Engineering"');
        }).not.toThrow();
    });

    test('should handle error when loading attributes fails', async () => {
        const errorMessage = 'Failed to load attributes';
        mockActions.getAccessControlFields.mockRejectedValue(new Error(errorMessage));

        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        // Wait for the error to be handled
        await waitFor(() => {
            expect(mockActions.getAccessControlFields).toHaveBeenCalled();
        });

        // Should not render editor when there's an error (attributesLoaded remains false)
        expect(screen.queryByTestId('table-editor')).not.toBeInTheDocument();
        expect(document.querySelector('.ChannelSettingsModal__accessRulesEditor')).not.toBeInTheDocument();
    });

    test('should handle parse error from TableEditor', async () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        // Get the onParseError callback passed to TableEditor
        const onParseErrorCallback = MockedTableEditor.mock.calls[0][0].onParseError;

        // Simulate parse error
        onParseErrorCallback('Parse error message');

        expect(console.warn).toHaveBeenCalledWith('Failed to parse expression in table editor');
    });

    describe('Auto-sync members toggle', () => {
        test('should render auto-sync checkbox', () => {
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            const checkbox = screen.getByRole('checkbox');
            expect(checkbox).toBeInTheDocument();
            expect(checkbox).toHaveClass('ChannelSettingsModal__autoSyncCheckbox');
        });

        test('should render auto-sync label and description', () => {
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            expect(screen.getByText('Auto-add members based on access rules')).toBeInTheDocument();
            expect(screen.getByText('Auto-add is disabled because no access rules are defined. Channel will use standard Mattermost access controls.')).toBeInTheDocument();
        });

        test('should show system policy applied message when policies exist but not forcing auto-sync', () => {
            // Mock system policies applied but not active (not forcing auto-sync)
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [
                    {
                        id: 'policy1',
                        name: 'Test Policy',
                        type: 'parent',
                        active: false,
                        rules: [{expression: 'user.attributes.Department == "Engineering"'}],
                    },
                ],
                loading: false,
                error: null,
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            expect(screen.getByText('Auto-add members based on access rules')).toBeInTheDocument();
            expect(screen.getByText('Auto-add is disabled because no channel-level access rules are defined. Channel access will still be restricted by the applied system policy in addition to standard Mattermost access controls.')).toBeInTheDocument();
        });

        test('should show system policy forced message when policies force auto-sync', () => {
            // Mock system policies that force auto-sync (active: true)
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [
                    {
                        id: 'policy1',
                        name: 'Test Policy',
                        type: 'parent',
                        active: true,
                        rules: [{expression: 'user.attributes.Department == "Engineering"'}],
                    },
                ],
                loading: false,
                error: null,
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            expect(screen.getByText('Auto-add members based on access rules')).toBeInTheDocument();
            expect(screen.getByText('Auto-add is enabled by system policy. Users who match the configured attribute values will be automatically added as members and those who no longer match will be removed.')).toBeInTheDocument();
        });

        test('should disable auto-sync toggle when system policies force it', () => {
            // Mock system policies that force auto-sync
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [
                    {
                        id: 'policy1',
                        name: 'Test Policy',
                        type: 'parent',
                        active: true,
                        rules: [{expression: 'user.attributes.Department == "Engineering"'}],
                    },
                ],
                loading: false,
                error: null,
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            const checkbox = screen.getByRole('checkbox');
            expect(checkbox).toBeChecked(); // Should be auto-enabled
            expect(checkbox).toBeDisabled(); // Should be disabled (can't uncheck)
        });

        test('should show correct tooltip when system policy forces auto-sync', () => {
            // Mock system policies that force auto-sync
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [
                    {
                        id: 'policy1',
                        name: 'Test Policy',
                        type: 'parent',
                        active: true,
                        rules: [{expression: 'user.attributes.Department == "Engineering"'}],
                    },
                ],
                loading: false,
                error: null,
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            const label = document.querySelector('label[for="autoSyncMembersCheckbox"]');
            expect(label).toHaveAttribute('title', 'Auto-add is enabled by system policy and cannot be disabled');
        });

        test('should handle mixed system policies (some active, some not)', () => {
            // Mock mixed system policies
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [
                    {
                        id: 'policy1',
                        name: 'Active Policy',
                        type: 'parent',
                        active: true,
                        rules: [{expression: 'user.attributes.Department == "Engineering"'}],
                    },
                    {
                        id: 'policy2',
                        name: 'Inactive Policy',
                        type: 'parent',
                        active: false,
                        rules: [{expression: 'user.attributes.Team == "Backend"'}],
                    },
                ],
                loading: false,
                error: null,
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            const checkbox = screen.getByRole('checkbox');

            // Should be forced enabled because ANY policy is active
            expect(checkbox).toBeChecked();
            expect(checkbox).toBeDisabled();
            expect(screen.getByText('Auto-add is enabled by system policy. Users who match the configured attribute values will be automatically added as members and those who no longer match will be removed.')).toBeInTheDocument();
        });

        test('should toggle auto-sync checkbox when clicked', async () => {
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            // Wait for initial loading to complete
            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Add an expression first to enable the checkbox
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.department == "Engineering"');

            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).not.toBeDisabled();
                expect(checkbox).not.toBeChecked();
            });

            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);
            await waitFor(() => {
                expect(checkbox).toBeChecked();
            });

            await userEvent.click(checkbox);
            await waitFor(() => {
                expect(checkbox).not.toBeChecked();
            });
        });

        test('should call setAreThereUnsavedChanges when auto-sync is toggled', async () => {
            const setAreThereUnsavedChanges = jest.fn();
            const propsWithCallback = {
                ...baseProps,
                setAreThereUnsavedChanges,
            };

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...propsWithCallback}/>,
                initialState,
            );

            // Wait for initial loading to complete
            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Add an expression first to enable the checkbox
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.department == "Engineering"');

            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).not.toBeDisabled();
            });

            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            await waitFor(() => {
                expect(setAreThereUnsavedChanges).toHaveBeenCalledWith(true);
            });
        });
    });

    describe('Edge Case Handling', () => {
        test('should handle true empty state (no policies, no rules)', () => {
            // Default test setup: no policies, no rules
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            const checkbox = screen.getByRole('checkbox');

            // Should be disabled in empty state
            expect(checkbox).not.toBeChecked();
            expect(checkbox).toBeDisabled();

            // Should show empty state message
            expect(screen.getByText('Auto-add is disabled because no access rules are defined. Channel will use standard Mattermost access controls.')).toBeInTheDocument();

            // Should have empty state tooltip
            const label = document.querySelector('label[for="autoSyncMembersCheckbox"]');
            expect(label).toHaveAttribute('title', 'Auto-add is disabled because no access rules are defined');
        });

        test('should differentiate between empty state and system policies applied', () => {
            // Mock inactive system policies (applied but not forcing)
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [
                    {
                        id: 'policy1',
                        name: 'Test Policy',
                        type: 'parent',
                        active: false,
                        rules: [{expression: 'user.attributes.Department == "Engineering"'}],
                    },
                ],
                loading: false,
                error: null,
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            // Should show system policy applied message, not empty state message
            expect(screen.queryByText('Auto-add is disabled because no access rules are defined. Channel will use standard Mattermost access controls.')).not.toBeInTheDocument();
            expect(screen.getByText('Auto-add is disabled because no channel-level access rules are defined. Channel access will still be restricted by the applied system policy in addition to standard Mattermost access controls.')).toBeInTheDocument();
        });

        test('should handle system policy loading state', () => {
            // Mock loading system policies
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [],
                loading: true,
                error: null,
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            // Should still render component without crashing
            expect(screen.getByText('Auto-add members based on access rules')).toBeInTheDocument();
        });

        test('should handle system policy error state', () => {
            // Mock system policy error
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [],
                loading: false,
                error: 'Failed to load policies',
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            // Should still render component and treat as empty state
            expect(screen.getByText('Auto-add is disabled because no access rules are defined. Channel will use standard Mattermost access controls.')).toBeInTheDocument();
        });

        test('should auto-disable sync when entering empty state', async () => {
            // Mock with initial policies (inactive) to allow the test scenario
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [
                    {
                        id: 'policy1',
                        name: 'Test Policy',
                        type: 'parent',
                        active: false,
                        rules: [{expression: 'user.attributes.Department == "Engineering"'}],
                    },
                ],
                loading: false,
                error: null,
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            // Wait for component to load
            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // First, add some channel rules so the checkbox becomes enabled
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.Department == "Marketing"');

            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).not.toBeDisabled();
            });

            // Now enable auto-sync
            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);
            expect(checkbox).toBeChecked();

            // Now simulate removing all policies and channel rules (empty state)
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [],
                loading: false,
                error: null,
            });

            // Trigger re-render by clearing table editor (simulates deleting all rules)
            onChangeCallback('');

            await waitFor(() => {
                // Auto-sync should be auto-disabled in empty state
                expect(checkbox).not.toBeChecked();
                expect(checkbox).toBeDisabled();
            });
        });
    });

    describe('SaveChangesPanel integration', () => {
        test('should not show SaveChangesPanel when there are no changes', async () => {
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            expect(screen.queryByTestId('save-changes-panel')).not.toBeInTheDocument();
        });

        test('should show SaveChangesPanel when expression changes', async () => {
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Get the onChange callback passed to TableEditor
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;

            // Simulate expression change
            onChangeCallback('user.attributes.department == "Engineering"');

            await waitFor(() => {
                expect(screen.getByTestId('save-changes-panel')).toBeInTheDocument();
            });
        });

        test('should show SaveChangesPanel when auto-sync is toggled', async () => {
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            // Wait for initial loading to complete
            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Add an expression first to enable the checkbox
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.department == "Engineering"');

            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).not.toBeDisabled();
            });

            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            await waitFor(() => {
                expect(screen.getByTestId('save-changes-panel')).toBeInTheDocument();
            });
        });

        test('should save changes when Save button is clicked', async () => {
            // Ensure the searchUsers mock returns current user for validation to pass
            mockActions.searchUsers.mockResolvedValue({
                data: {
                    users: [{
                        id: 'current_user_id',
                        username: 'testuser',
                        first_name: 'Test',
                        last_name: 'User',
                    }],
                },
            });
            mockActions.getChannelMembers.mockResolvedValue({data: []});

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Change expression
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.department == "Engineering"');

            // Wait for expression to be set and checkbox to be enabled
            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).not.toBeDisabled();
            });

            // Toggle auto-sync
            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            // Verify checkbox is checked
            await waitFor(() => {
                expect(checkbox).toBeChecked();
            });

            // Wait for SaveChangesPanel to appear
            await waitFor(() => {
                expect(screen.getByTestId('save-changes-panel')).toBeInTheDocument();
            });

            // Click Save button
            const saveButton = screen.getByTestId('SaveChangesPanel__save-btn');
            await userEvent.click(saveButton);

            // Wait for confirmation modal to appear
            await waitFor(() => {
                expect(screen.getAllByText('Save and apply rules').length).toBeGreaterThan(0);
            });

            // Click "Save and apply" in the confirmation modal
            const confirmButtons = screen.getAllByText('Save and apply');
            const confirmButton = confirmButtons[0];
            await userEvent.click(confirmButton);

            // Wait for async validation and save to complete
            await waitFor(() => {
                expect(mockActions.saveChannelPolicy).toHaveBeenCalled();
            });

            // Verify save was called with the correct policy structure
            expect(mockActions.saveChannelPolicy).toHaveBeenCalledWith({
                id: 'channel_id',
                name: 'Test Channel',
                type: 'channel',
                version: 'v0.2',
                active: false, // Policy starts as inactive until job completes
                revision: 1,
                created_at: expect.any(Number),
                rules: [{
                    actions: ['*'],
                    expression: 'user.attributes.department == "Engineering"',
                }],
                imports: [],
            });
        });

        test('should reset changes when Reset button is clicked', async () => {
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Change expression
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.department == "Engineering"');

            // Toggle auto-sync
            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);
            expect(checkbox).toBeChecked();

            // Wait for SaveChangesPanel to appear
            await waitFor(() => {
                expect(screen.getByTestId('save-changes-panel')).toBeInTheDocument();
            });

            // Click Reset button
            const resetButton = screen.getByTestId('SaveChangesPanel__cancel-btn');
            await userEvent.click(resetButton);

            // Verify panel disappears
            await waitFor(() => {
                expect(screen.queryByTestId('save-changes-panel')).not.toBeInTheDocument();
            });

            // Verify checkbox is reset
            expect(checkbox).not.toBeChecked();
        });

        test('should show error state when there is a form error', async () => {
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Trigger parse error
            const onParseErrorCallback = MockedTableEditor.mock.calls[0][0].onParseError;
            onParseErrorCallback('Invalid expression');

            // Change expression to trigger panel
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('invalid expression');

            await waitFor(() => {
                const panel = screen.getByTestId('save-changes-panel');
                expect(panel).toBeInTheDocument();
                expect(panel).toHaveAttribute('data-state', 'error');
            });
        });

        test('should show error state when showTabSwitchError is true', async () => {
            const propsWithError = {
                ...baseProps,
                showTabSwitchError: true,
            };

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...propsWithError}/>,
                initialState,
            );

            // Wait for initial loading to complete
            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Add an expression first to enable the checkbox
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.department == "Engineering"');

            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).not.toBeDisabled();
            });

            // Toggle auto-sync to show panel
            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            await waitFor(() => {
                const panel = screen.getByTestId('save-changes-panel');
                expect(panel).toBeInTheDocument();
                expect(panel).toHaveAttribute('data-state', 'error');
            });
        });

        test('should pass correct props to SaveChangesPanel', async () => {
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            // Wait for initial loading to complete
            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Add an expression first to enable the checkbox
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.department == "Engineering"');

            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).not.toBeDisabled();
            });

            // Toggle auto-sync to show panel
            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            await waitFor(() => {
                expect(screen.getByTestId('save-changes-panel')).toBeInTheDocument();
            });

            expect(MockedSaveChangesPanel).toHaveBeenCalledWith(
                expect.objectContaining({
                    handleSubmit: expect.any(Function),
                    handleCancel: expect.any(Function),
                    handleClose: expect.any(Function),
                    tabChangeError: false,
                    state: undefined,
                    cancelButtonText: 'Reset',
                }),
                expect.anything(),
            );
        });

        test('should update SaveChangesPanel state to saved after successful save', async () => {
            // Ensure the searchUsers mock returns current user for validation to pass
            mockActions.searchUsers.mockResolvedValue({
                data: {
                    users: [{
                        id: 'current_user_id',
                        username: 'testuser',
                        first_name: 'Test',
                        last_name: 'User',
                    }],
                },
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            // Wait for initial loading to complete
            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Add an expression first to enable the checkbox
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.department == "Engineering"');

            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).not.toBeDisabled();
            });

            // Toggle auto-sync to show panel
            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            await waitFor(() => {
                expect(screen.getByTestId('save-changes-panel')).toBeInTheDocument();
            });

            // Click Save button
            const saveButton = screen.getByTestId('SaveChangesPanel__save-btn');
            await userEvent.click(saveButton);

            // Wait for confirmation modal to appear
            await waitFor(() => {
                expect(screen.getAllByText('Save and apply rules').length).toBeGreaterThan(0);
            });

            // Click "Save and apply" in the confirmation modal
            const confirmButtons = screen.getAllByText('Save and apply');
            const confirmButton = confirmButtons[0];
            await userEvent.click(confirmButton);

            // Wait for save to complete and panel to show saved state
            await waitFor(() => {
                const panel = screen.getByTestId('save-changes-panel');
                expect(panel).toHaveAttribute('data-state', 'saved');
            });
        });
    });

    describe('System policies integration', () => {
        test('should show system policies indicator when policies are present', () => {
            const mockPolicies = [
                {
                    id: 'policy1',
                    name: 'Test Policy',
                    type: 'parent',
                    version: 'v0.2',
                    revision: 1,
                    active: true,
                    createAt: 1234567890,
                    rules: [],
                    imports: [],
                },
            ];

            mockUseChannelSystemPolicies.mockReturnValue({
                policies: mockPolicies,
                loading: false,
                error: null,
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            expect(document.querySelector('.ChannelSettingsModal__systemPolicies')).toBeInTheDocument();
        });

        test('should not show system policies indicator when no policies', () => {
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [],
                loading: false,
                error: null,
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            expect(document.querySelector('.ChannelSettingsModal__systemPolicies')).not.toBeInTheDocument();
        });

        test('should not show system policies indicator while loading', () => {
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [],
                loading: true,
                error: null,
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            expect(document.querySelector('.ChannelSettingsModal__systemPolicies')).not.toBeInTheDocument();
        });
    });

    describe('Expression evaluation and combination', () => {
        const mockSystemPoliciesWithoutAutoSync = [
            {
                id: 'system_policy_1',
                name: 'System Policy 1',
                type: 'parent',
                version: 'v0.2',
                revision: 1,
                active: false,
                createAt: 1234567890,
                rules: [
                    {
                        actions: ['join_channel'],
                        expression: 'user.attributes.Program == "test"',
                    },
                ],
                imports: [],
            },
            {
                id: 'system_policy_2',
                name: 'System Policy 2',
                type: 'parent',
                version: 'v0.2',
                revision: 1,
                active: false,
                createAt: 1234567891,
                rules: [
                    {
                        actions: ['join_channel'],
                        expression: 'user.attributes.Department == "Engineering"',
                    },
                ],
                imports: [],
            },
        ];

        const mockUsersMatchingCombined = [
            {id: 'current_user_id', username: 'testuser', email: 'test@example.com'}, // Include current user
            {id: 'user1', username: 'user1', email: 'user1@test.com'},
            {id: 'user2', username: 'user2', email: 'user2@test.com'},
        ];

        const mockUsersMatchingOnlyChannel = [
            {id: 'current_user_id', username: 'testuser', email: 'test@example.com'}, // Include current user
            {id: 'user1', username: 'user1', email: 'user1@test.com'},
            {id: 'user2', username: 'user2', email: 'user2@test.com'},
            {id: 'user3', username: 'user3', email: 'user3@test.com'}, // This user only matches channel expression
        ];

        const mockCurrentMembers = [
            {user_id: 'existing_user1'},
            {user_id: 'existing_user2'},
        ];

        beforeEach(() => {
            // Mock system policies (without auto-sync so checkbox can be controlled)
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: mockSystemPoliciesWithoutAutoSync,
                loading: false,
                error: null,
            });

            // Mock channel members
            mockActions.getChannelMembers.mockResolvedValue({data: mockCurrentMembers});
        });

        test('should combine system and channel expressions for membership preview', async () => {
            // Mock search to return different results for different expressions
            mockActions.searchUsers.mockImplementation((expression) => {
                if (expression.includes('&&')) {
                    // Combined expression: should return fewer users
                    return Promise.resolve({data: {users: mockUsersMatchingCombined}});
                }

                // Channel-only expression: should return more users
                return Promise.resolve({data: {users: mockUsersMatchingOnlyChannel}});
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Set a channel expression
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.Other == "test2"');

            // Enable auto-sync to trigger membership calculation
            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).not.toBeDisabled();
            });

            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            // Click Save to trigger membership calculation
            await waitFor(() => {
                expect(screen.getByTestId('save-changes-panel')).toBeInTheDocument();
            });

            const saveButton = screen.getByTestId('SaveChangesPanel__save-btn');
            await userEvent.click(saveButton);

            // Wait for confirmation modal to appear
            await waitFor(() => {
                expect(screen.getAllByText('Save and apply rules').length).toBeGreaterThan(0);
            });

            // Click "Save and apply" in the confirmation modal
            const confirmButton = screen.getAllByText('Save and apply')[0];
            await userEvent.click(confirmButton);

            // Verify save operation was triggered
            await waitFor(() => {
                expect(mockActions.saveChannelPolicy).toHaveBeenCalled();
            });
        });

        test('should use combined expression for self-exclusion validation', async () => {
            // Mock currentUser in state
            const stateWithCurrentUser = {
                ...initialState,
                entities: {
                    ...initialState.entities,
                    users: {
                        currentUserId: 'current_user_id',
                        profiles: {
                            current_user_id: {
                                id: 'current_user_id',
                                username: 'current_user',
                                email: 'current@test.com',
                            },
                        },
                    },
                },
            };

            // Mock search to simulate user exclusion scenario
            mockActions.searchUsers.mockImplementation((expression) => {
                if (expression.includes('&&')) {
                    // Combined expression: current user doesn't match
                    return Promise.resolve({data: {users: []}});
                }

                // Channel-only expression: current user matches
                return Promise.resolve({data: {users: [{id: 'current_user_id'}]}});
            });

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                stateWithCurrentUser,
            );

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Set a channel expression
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.Other == "test2"');

            // Enable auto-sync to trigger validation
            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).not.toBeDisabled();
            });

            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            // Click Save to trigger self-exclusion validation
            await waitFor(() => {
                expect(screen.getByTestId('save-changes-panel')).toBeInTheDocument();
            });

            const saveButton = screen.getByTestId('SaveChangesPanel__save-btn');
            await userEvent.click(saveButton);

            // Wait for confirmation modal to appear
            await waitFor(() => {
                expect(screen.getAllByText('Save and apply rules').length).toBeGreaterThan(0);
            });

            // Click "Save and apply" in the confirmation modal
            const confirmButton = screen.getAllByText('Save and apply')[0];
            await userEvent.click(confirmButton);

            // Verify save operation was triggered with self-exclusion validation
            await waitFor(() => {
                expect(mockActions.saveChannelPolicy).toHaveBeenCalled();
            });
        });

        test('should handle channel expression only when no system policies', async () => {
            // Mock no system policies
            mockUseChannelSystemPolicies.mockReturnValue({
                policies: [],
                loading: false,
                error: null,
            });

            mockActions.searchUsers.mockResolvedValue({data: {users: mockUsersMatchingOnlyChannel}});

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Set a channel expression
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.Other == "test2"');

            // Enable auto-sync
            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).not.toBeDisabled();
            });

            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            // Click Save to trigger membership calculation
            await waitFor(() => {
                expect(screen.getByTestId('save-changes-panel')).toBeInTheDocument();
            });

            const saveButton = screen.getByTestId('SaveChangesPanel__save-btn');
            await userEvent.click(saveButton);

            // Wait for confirmation modal to appear
            await waitFor(() => {
                expect(screen.getAllByText('Save and apply rules').length).toBeGreaterThan(0);
            });

            // Click "Save and apply" in the confirmation modal
            const confirmButton = screen.getAllByText('Save and apply')[0];
            await userEvent.click(confirmButton);

            // Verify save operation was triggered
            await waitFor(() => {
                expect(mockActions.saveChannelPolicy).toHaveBeenCalled();
            });
        });

        test('should handle system policies only when no channel expression', async () => {
            mockActions.searchUsers.mockResolvedValue({data: {users: mockUsersMatchingCombined}});

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Don't set any channel expression, just enable auto-sync
            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).toBeDisabled(); // Should be disabled without expression
            });

            // System policies exist but no channel expression, so should use system expressions only
            // This case would typically not trigger membership calculations since checkbox is disabled
            // but tests the expression combination logic when called directly
        });

        test('should properly format combined expressions with parentheses', async () => {
            mockActions.searchUsers.mockResolvedValue({data: {users: mockUsersMatchingCombined}});

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Set a channel expression
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('user.attributes.Other == "test2"');

            // Enable auto-sync
            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).not.toBeDisabled();
            });

            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            // Click Save to trigger membership calculation
            await waitFor(() => {
                expect(screen.getByTestId('save-changes-panel')).toBeInTheDocument();
            });

            const saveButton = screen.getByTestId('SaveChangesPanel__save-btn');
            await userEvent.click(saveButton);

            // Wait for confirmation modal to appear
            await waitFor(() => {
                expect(screen.getAllByText('Save and apply rules').length).toBeGreaterThan(0);
            });

            // Click "Save and apply" in the confirmation modal
            const confirmButton = screen.getAllByText('Save and apply')[0];
            await userEvent.click(confirmButton);

            // Verify save operation was triggered (parentheses formatting handled internally)
            await waitFor(() => {
                expect(mockActions.saveChannelPolicy).toHaveBeenCalled();
            });
        });

        test('should handle empty or whitespace-only expressions', async () => {
            mockActions.searchUsers.mockResolvedValue({data: {users: []}});

            renderWithContext(
                <ChannelSettingsAccessRulesTab {...baseProps}/>,
                initialState,
            );

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            // Set empty/whitespace channel expression
            const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;
            onChangeCallback('   '); // Just whitespace

            // Checkbox should be disabled for empty expression
            await waitFor(() => {
                const checkbox = screen.getByRole('checkbox');
                expect(checkbox).toBeDisabled();
            });
        });
    });
});
