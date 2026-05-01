// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Permissions} from 'mattermost-redux/constants';

import TeamSettingsModal from 'components/team_settings_modal/team_settings_modal';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

// Mock Redux actions
jest.mock('mattermost-redux/actions/teams', () => ({
    patchTeam: jest.fn(() => async () => ({data: {}, error: null})),
    getTeam: jest.fn(() => async () => ({data: {}, error: null})),
    removeTeamIcon: jest.fn(() => async () => ({data: {}, error: null})),
    setTeamIcon: jest.fn(() => async () => ({data: {}, error: null})),
}));

describe('components/team_settings_modal', () => {
    const baseProps = {
        isOpen: true,
        onExited: jest.fn(),
    };

    const baseState = {
        entities: {
            teams: {
                currentTeamId: 'team-id',
                teams: {
                    'team-id': {
                        id: 'team-id',
                        display_name: 'Team Name',
                        description: 'Team Description',
                        name: 'team-name',
                    },
                },
                myMembers: {
                    'team-id': {
                        team_id: 'team-id',
                        user_id: 'user-id',
                        roles: 'team_user',
                    },
                },
            },
            roles: {
                roles: {
                    team_user: {
                        permissions: [Permissions.INVITE_USER],
                    },
                },
            },
            users: {
                currentUserId: 'user-id',
                profiles: {
                    'user-id': {
                        id: 'user-id',
                        roles: 'team_user',
                    },
                },
            },
        },
    };

    test('should hide the modal when the close button is clicked', async () => {
        renderWithContext(
            <TeamSettingsModal
                {...baseProps}
            />,
            baseState,
        );
        const modal = screen.getByRole('dialog', {name: 'Team Settings'});
        expect(modal).toBeInTheDocument();
        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        await waitFor(() => {
            expect(baseProps.onExited).toHaveBeenCalled();
        });
    });

    test('should display access tab when can invite users', async () => {
        renderWithContext(
            <TeamSettingsModal
                {...baseProps}
            />,
            baseState,
        );
        const infoButton = screen.getByRole('tab', {name: 'info'});
        expect(infoButton).toBeDefined();
        const accessButton = screen.getByRole('tab', {name: 'access'});
        expect(accessButton).toBeDefined();
    });

    test('should not display access tab when can not invite users', async () => {
        const stateWithoutPermission = {
            ...baseState,
            entities: {
                ...baseState.entities,
                roles: {
                    roles: {
                        team_user: {
                            permissions: [],
                        },
                    },
                },
            },
        };

        renderWithContext(
            <TeamSettingsModal
                {...baseProps}
            />,
            stateWithoutPermission,
        );
        const tabs = screen.getAllByRole('tab');
        expect(tabs.length).toEqual(1);
        const infoButton = screen.getByRole('tab', {name: 'info'});
        expect(infoButton).toBeDefined();
    });

    test('should warn on first close attempt with unsaved changes and stay open', async () => {
        renderWithContext(
            <TeamSettingsModal
                {...baseProps}
            />,
            baseState,
        );

        const modal = screen.getByRole('dialog', {name: 'Team Settings'});
        expect(modal).toBeInTheDocument();

        // Create unsaved changes by modifying team name
        const nameInput = screen.getByDisplayValue('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Modified Team Name');

        // Attempt to close modal with unsaved changes
        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        // Verify modal remains open
        expect(modal).toBeInTheDocument();
        expect(modal).toBeVisible();

        // Verify warning message is displayed
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();

        // Verify close was prevented
        expect(baseProps.onExited).not.toHaveBeenCalled();
    });

    test('should allow close on second attempt with unsaved changes (warn-once behavior)', async () => {
        renderWithContext(
            <TeamSettingsModal
                {...baseProps}
            />,
            baseState,
        );

        // Create unsaved changes
        const nameInput = screen.getByDisplayValue('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Modified Team Name');

        const closeButton = screen.getByLabelText('Close');

        // First close attempt triggers warning
        await userEvent.click(closeButton);

        // Verify warning is displayed
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();

        // Second close attempt closes modal
        await userEvent.click(closeButton);

        // Verify modal closes successfully
        await waitFor(() => {
            expect(baseProps.onExited).toHaveBeenCalled();
        });
    });

    test('should close modal normally when no unsaved changes', async () => {
        renderWithContext(
            <TeamSettingsModal
                {...baseProps}
            />,
            baseState,
        );

        const modal = screen.getByRole('dialog', {name: 'Team Settings'});
        expect(modal).toBeInTheDocument();

        // Close modal with no unsaved changes
        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        // Verify modal closes normally
        await waitFor(() => {
            expect(baseProps.onExited).toHaveBeenCalled();
        });
    });

    test('should reset warning state when changes are saved', async () => {
        renderWithContext(
            <TeamSettingsModal
                {...baseProps}
            />,
            baseState,
        );

        // Create unsaved changes
        const nameInput = screen.getByDisplayValue('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Modified Team Name');

        // Save changes immediately (without triggering warning first)
        const saveButton = screen.getByText('Save');
        await userEvent.click(saveButton);

        // Wait for save to complete and "Settings saved" message
        await waitFor(() => {
            expect(screen.getByText('Settings saved')).toBeInTheDocument();
        });

        // After saving, close modal - should work immediately (single click)
        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        // Verify modal closes successfully without warning
        await waitFor(() => {
            expect(baseProps.onExited).toHaveBeenCalled();
        });
    });
});
