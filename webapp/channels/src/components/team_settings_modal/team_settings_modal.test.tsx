// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import TeamSettingsModal from 'components/team_settings_modal/team_settings_modal';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

describe('components/team_settings_modal', () => {
    const baseProps = {
        onExited: jest.fn(),
        canInviteUsers: true,
    };

    test('should hide the modal when the close button is clicked', async () => {
        renderWithContext(
            <TeamSettingsModal
                {...baseProps}
            />,
        );
        const modal = screen.getByRole('dialog', {name: 'Close Team Settings'});
        expect(modal.className).toBe('fade in modal');
        await userEvent.click(screen.getByText('Close'));
        expect(modal.className).toBe('fade modal');
    });

    test('should display access tab when can invite users', async () => {
        const props = {...baseProps, canInviteUsers: true};
        renderWithContext(
            <TeamSettingsModal
                {...props}
            />,
        );
        const infoButton = screen.getByRole('tab', {name: 'info'});
        expect(infoButton).toBeDefined();
        const accessButton = screen.getByRole('tab', {name: 'access'});
        expect(accessButton).toBeDefined();
    });

    test('should not display access tab when can not invite users', async () => {
        const props = {...baseProps, canInviteUsers: false};
        renderWithContext(
            <TeamSettingsModal
                {...props}
            />,
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
            {
                entities: {
                    teams: {
                        currentTeamId: 'team-id',
                        teams: {
                            'team-id': {
                                id: 'team-id',
                                display_name: 'Team Name',
                                description: 'Team Description',
                            },
                        },
                    },
                },
            },
        );

        const modal = screen.getByRole('dialog', {name: 'Close Team Settings'});
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
            {
                entities: {
                    teams: {
                        currentTeamId: 'team-id',
                        teams: {
                            'team-id': {
                                id: 'team-id',
                                display_name: 'Team Name',
                                description: 'Team Description',
                            },
                        },
                    },
                },
            },
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
            {
                entities: {
                    teams: {
                        currentTeamId: 'team-id',
                        teams: {
                            'team-id': {
                                id: 'team-id',
                                display_name: 'Team Name',
                                description: 'Team Description',
                            },
                        },
                    },
                },
            },
        );

        const modal = screen.getByRole('dialog', {name: 'Close Team Settings'});
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
            {
                entities: {
                    teams: {
                        currentTeamId: 'team-id',
                        teams: {
                            'team-id': {
                                id: 'team-id',
                                display_name: 'Team Name',
                                description: 'Team Description',
                            },
                        },
                    },
                },
            },
        );

        // Create unsaved changes
        const nameInput = screen.getByDisplayValue('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Modified Team Name');

        const closeButton = screen.getByLabelText('Close');

        // Trigger warning by attempting to close
        await userEvent.click(closeButton);

        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();

        // Save changes to reset warning state
        const saveButton = screen.getByText('Save');
        await userEvent.click(saveButton);

        // Close modal after saving
        await userEvent.click(closeButton);

        // Verify modal closes successfully
        await waitFor(() => {
            expect(baseProps.onExited).toHaveBeenCalled();
        });
    });
});

