// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';

import CreateUserGroupsModal from './create_user_groups_modal';

// Mock AddUserToGroupMultiSelect to expose onSubmitCallback for testing
vi.mock('components/add_user_to_group_multiselect', () => {
    const MockAddUserToGroupMultiSelect = ({onSubmitCallback, addUserCallback}: {
        onSubmitCallback: (users: UserProfile[]) => void;
        addUserCallback: (users: UserProfile[]) => void;
    }) => {
        // Simulate that users have been added to make savingEnabled work
        React.useEffect(() => {
            addUserCallback([
                {id: 'user-1', username: 'user1'},
                {id: 'user-2', username: 'user2'},
            ] as UserProfile[]);
        }, [addUserCallback]);

        return (
            <div data-testid='mock-multiselect'>
                <button
                    data-testid='mock-submit'
                    type='button'
                    onClick={() => onSubmitCallback([
                        {id: 'user-1', username: 'user1'} as UserProfile,
                        {id: 'user-2', username: 'user2'} as UserProfile,
                    ])}
                >
                    {'Create Group'}
                </button>
            </div>
        );
    };
    return {default: MockAddUserToGroupMultiSelect};
});

describe('component/create_user_groups_modal', () => {
    const baseProps = {
        onExited: vi.fn(),
        backButtonCallback: vi.fn(),
        actions: {
            openModal: vi.fn(),
            createGroupWithUserIds: vi.fn().mockImplementation(() => Promise.resolve({})),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot with back button', async () => {
        const {baseElement} = renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot without back button', async () => {
        const {baseElement} = renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                backButtonCallback={undefined}
            />,
        );
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        expect(baseElement).toMatchSnapshot();
    });

    test('should create group', async () => {
        const createGroupWithUserIds = vi.fn().mockImplementation(() => Promise.resolve({}));
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('nameInput')).toBeInTheDocument();
        });

        // Fill in the name and mention fields
        const nameInput = screen.getByTestId('nameInput');
        const mentionInput = screen.getByTestId('mentionInput');

        fireEvent.change(nameInput, {target: {value: 'Ursa'}});
        fireEvent.change(mentionInput, {target: {value: 'ursa'}});

        // Verify inputs are updated
        expect(nameInput).toHaveValue('Ursa');
        expect(mentionInput).toHaveValue('ursa');

        // Trigger createGroup via the mocked multiselect
        const submitButton = screen.getByTestId('mock-submit');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(createGroupWithUserIds).toHaveBeenCalledTimes(1);
        });
    });

    test('mention regex error', async () => {
        const createGroupWithUserIds = vi.fn().mockImplementation(() => Promise.resolve({}));
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('nameInput')).toBeInTheDocument();
        });

        // Fill in with invalid characters in mention
        const nameInput = screen.getByTestId('nameInput');
        const mentionInput = screen.getByTestId('mentionInput');

        fireEvent.change(nameInput, {target: {value: 'Ursa'}});
        fireEvent.change(mentionInput, {target: {value: 'ursa!/'}});

        // Mention with invalid characters should be in the input
        expect(mentionInput).toHaveValue('ursa!/');

        // Trigger createGroup - should fail validation
        const submitButton = screen.getByTestId('mock-submit');
        fireEvent.click(submitButton);

        // Should NOT call createGroupWithUserIds due to regex validation
        expect(createGroupWithUserIds).not.toHaveBeenCalled();

        // Should show error message
        await waitFor(() => {
            expect(screen.getByText('Invalid character in mention.')).toBeInTheDocument();
        });
    });

    test('create a mention with special characters', async () => {
        const createGroupWithUserIds = vi.fn().mockImplementation(() => Promise.resolve({}));
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('nameInput')).toBeInTheDocument();
        });

        // Fill in with allowed special characters (. - _)
        const nameInput = screen.getByTestId('nameInput');
        const mentionInput = screen.getByTestId('mentionInput');

        fireEvent.change(nameInput, {target: {value: 'Ursa'}});
        fireEvent.change(mentionInput, {target: {value: 'ursa.-_'}});

        // Valid special characters should be accepted
        expect(mentionInput).toHaveValue('ursa.-_');

        // Trigger createGroup
        const submitButton = screen.getByTestId('mock-submit');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(createGroupWithUserIds).toHaveBeenCalledTimes(1);
        });
    });

    test('fail to create with empty name', async () => {
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('nameInput')).toBeInTheDocument();
        });

        // Leave name empty, fill mention
        const mentionInput = screen.getByTestId('mentionInput');
        fireEvent.change(mentionInput, {target: {value: 'ursa'}});

        // Name input should still be empty
        expect(screen.getByTestId('nameInput')).toHaveValue('');

        // Trigger createGroup
        const submitButton = screen.getByTestId('mock-submit');
        fireEvent.click(submitButton);

        // createGroupWithUserIds should not be called without valid inputs
        expect(baseProps.actions.createGroupWithUserIds).not.toHaveBeenCalled();

        // Should show error message
        await waitFor(() => {
            expect(screen.getByText('Name is a required field.')).toBeInTheDocument();
        });
    });

    test('fail to create with empty mention', async () => {
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('mentionInput')).toBeInTheDocument();
        });

        // Fill name, leave mention empty
        const nameInput = screen.getByTestId('nameInput');
        fireEvent.change(nameInput, {target: {value: 'Ursa'}});

        // Clear mention (which auto-populated from name)
        const mentionInput = screen.getByTestId('mentionInput');
        fireEvent.change(mentionInput, {target: {value: ''}});

        expect(mentionInput).toHaveValue('');

        // Trigger createGroup
        const submitButton = screen.getByTestId('mock-submit');
        fireEvent.click(submitButton);

        // createGroupWithUserIds should not be called without valid inputs
        expect(baseProps.actions.createGroupWithUserIds).not.toHaveBeenCalled();

        // Should show error message
        await waitFor(() => {
            expect(screen.getByText('Mention is a required field.')).toBeInTheDocument();
        });
    });

    test('should create when mention begins with @', async () => {
        const createGroupWithUserIds = vi.fn().mockImplementation(() => Promise.resolve({}));
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('mentionInput')).toBeInTheDocument();
        });

        // Fill in with @ prefix
        const nameInput = screen.getByTestId('nameInput');
        const mentionInput = screen.getByTestId('mentionInput');

        fireEvent.change(nameInput, {target: {value: 'Ursa'}});
        fireEvent.change(mentionInput, {target: {value: '@ursa'}});

        // @ prefix should be accepted
        expect(mentionInput).toHaveValue('@ursa');

        // Trigger createGroup
        const submitButton = screen.getByTestId('mock-submit');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(createGroupWithUserIds).toHaveBeenCalledTimes(1);
        });
    });

    test('should fail to create with unknown error', async () => {
        const createGroupWithUserIds = vi.fn().mockImplementation(() =>
            Promise.resolve({error: {message: 'test error', server_error_id: 'insert_error'}}),
        );

        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('nameInput')).toBeInTheDocument();
        });

        // Fill in valid inputs
        const nameInput = screen.getByTestId('nameInput');
        const mentionInput = screen.getByTestId('mentionInput');

        fireEvent.change(nameInput, {target: {value: 'Ursa'}});
        fireEvent.change(mentionInput, {target: {value: '@ursa'}});

        expect(nameInput).toHaveValue('Ursa');
        expect(mentionInput).toHaveValue('@ursa');

        // Trigger createGroup
        const submitButton = screen.getByTestId('mock-submit');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(createGroupWithUserIds).toHaveBeenCalledTimes(1);
        });

        // Should show unknown error message
        await waitFor(() => {
            expect(screen.getByText('An unknown error has occurred.')).toBeInTheDocument();
        });
    });

    test('should fail to create with duplicate mention error', async () => {
        const createGroupWithUserIds = vi.fn().mockImplementation(() =>
            Promise.resolve({error: {message: 'test error', server_error_id: 'app.custom_group.unique_name'}}),
        );

        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('mentionInput')).toBeInTheDocument();
        });

        // Fill in inputs
        const nameInput = screen.getByTestId('nameInput');
        const mentionInput = screen.getByTestId('mentionInput');

        fireEvent.change(nameInput, {target: {value: 'Ursa'}});
        fireEvent.change(mentionInput, {target: {value: '@ursa'}});

        expect(mentionInput).toHaveValue('@ursa');

        // Trigger createGroup
        const submitButton = screen.getByTestId('mock-submit');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(createGroupWithUserIds).toHaveBeenCalledTimes(1);
        });

        // Should show duplicate mention error message
        await waitFor(() => {
            expect(screen.getByText('Mention needs to be unique.')).toBeInTheDocument();
        });
    });

    test('fail to create with reserved word for mention', async () => {
        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('mentionInput')).toBeInTheDocument();
        });

        const nameInput = screen.getByTestId('nameInput');
        const mentionInput = screen.getByTestId('mentionInput');

        // Test reserved word 'all'
        fireEvent.change(nameInput, {target: {value: 'Ursa'}});
        fireEvent.change(mentionInput, {target: {value: 'all'}});
        expect(mentionInput).toHaveValue('all');

        // Trigger createGroup
        const submitButton = screen.getByTestId('mock-submit');
        fireEvent.click(submitButton);

        // createGroupWithUserIds should not be called
        expect(baseProps.actions.createGroupWithUserIds).not.toHaveBeenCalled();

        // Should show reserved word error
        await waitFor(() => {
            expect(screen.getByText('Mention contains a reserved word.')).toBeInTheDocument();
        });
    });

    test('should fail to create with duplicate mention error', async () => {
        const createGroupWithUserIds = vi.fn().mockImplementation(() =>
            Promise.resolve({error: {message: 'test error', server_error_id: 'app.group.username_conflict'}}),
        );

        renderWithContext(
            <CreateUserGroupsModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    createGroupWithUserIds,
                }}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('mentionInput')).toBeInTheDocument();
        });

        // Fill in inputs
        const nameInput = screen.getByTestId('nameInput');
        const mentionInput = screen.getByTestId('mentionInput');

        fireEvent.change(nameInput, {target: {value: 'Ursa'}});
        fireEvent.change(mentionInput, {target: {value: '@ursa'}});

        expect(mentionInput).toHaveValue('@ursa');

        // Trigger createGroup
        const submitButton = screen.getByTestId('mock-submit');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(createGroupWithUserIds).toHaveBeenCalledTimes(1);
        });

        // Should show username conflict error message
        await waitFor(() => {
            expect(screen.getByText('A username already exists with this name. Mention must be unique.')).toBeInTheDocument();
        });
    });
});
