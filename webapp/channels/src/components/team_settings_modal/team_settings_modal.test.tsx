// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen, act} from '@testing-library/react';
import React from 'react';

import TeamSettingsModal from 'components/team_settings_modal/team_settings_modal';

import {renderWithContext} from 'tests/react_testing_utils';

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
        fireEvent.click(screen.getByText('Close'));
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

    test('should prevent modal close and show error state when trying to close with unsaved changes', async () => {
        jest.useFakeTimers();

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

        // Simulate unsaved changes by modifying the team name input
        const nameInput = screen.getByDisplayValue('Team Name');
        act(() => {
            fireEvent.change(nameInput, {target: {value: 'Modified Team Name'}});
        });

        // Try to close the modal by clicking the close button
        const closeButton = screen.getByLabelText('Close');
        act(() => {
            fireEvent.click(closeButton);
        });

        // Modal should still be visible (not closed due to unsaved changes)
        expect(modal).toBeInTheDocument();
        expect(modal).toBeVisible();

        // Should show SaveChangesPanel with error state (red banner)
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();

        // Fast-forward time to test the 3-second timeout
        act(() => {
            jest.advanceTimersByTime(3000);
        });

        jest.useRealTimers();
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

        // Try to close the modal without making any changes
        const closeButton = screen.getByLabelText('Close');
        act(() => {
            fireEvent.click(closeButton);
        });

        // Modal should close (fade out)
        expect(modal.className).toBe('fade modal');
    });
});

