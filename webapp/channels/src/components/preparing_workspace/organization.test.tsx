// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import Organization from './organization';
import {Animations} from './steps';

describe('components/preparing_workspace/Organization', () => {
    const baseProps: ComponentProps<typeof Organization> = {
        show: true,
        transitionDirection: Animations.Reasons.EnterFromBefore,
        next: jest.fn(),
        organization: 'Acme Corp',
        setOrganization: jest.fn(),
        setInviteId: jest.fn(),
        createTeam: jest.fn(),
        updateTeam: jest.fn(),
    };

    const initialState = {
        entities: {
            teams: {
                teams: {},
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('advances after the team is created', async () => {
        const createTeam = jest.fn().mockResolvedValue({error: null, newTeam: {id: 'team1', invite_id: 'invite1'}});
        renderWithContext(
            <Organization
                {...baseProps}
                createTeam={createTeam}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('continue'));

        await waitFor(() => expect(baseProps.next).toHaveBeenCalledTimes(1));
        expect(createTeam).toHaveBeenCalledWith('Acme Corp');
        expect(baseProps.setInviteId).toHaveBeenCalledWith('invite1');
    });

    it('stays on the step and shows an error when the team cannot be created', async () => {
        const createTeam = jest.fn().mockResolvedValue({error: 'Something went wrong', newTeam: null});
        renderWithContext(
            <Organization
                {...baseProps}
                createTeam={createTeam}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('continue'));

        expect(await screen.findByText('There was an error, please try again.')).toBeInTheDocument();
        expect(baseProps.next).not.toHaveBeenCalled();
        expect(baseProps.setInviteId).toHaveBeenCalledWith('');
    });

    it('stays on the step and shows an error when the existing team cannot be updated', async () => {
        const updateTeam = jest.fn().mockResolvedValue({error: 'Something went wrong', updatedTeam: null});
        renderWithContext(
            <Organization
                {...baseProps}
                updateTeam={updateTeam}
            />,
            {
                entities: {
                    teams: {
                        teams: {team1: {id: 'team1', display_name: 'Old Name', delete_at: 0}},
                    },
                },
            },
        );

        await userEvent.click(screen.getByTestId('continue'));

        expect(await screen.findByText('There was an error, please try again.')).toBeInTheDocument();
        expect(baseProps.next).not.toHaveBeenCalled();
    });

    it('does not create a team when the organization name is invalid', async () => {
        const createTeam = jest.fn();
        renderWithContext(
            <Organization
                {...baseProps}
                organization='a'
                createTeam={createTeam}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('continue'));

        expect(createTeam).not.toHaveBeenCalled();
        expect(baseProps.next).not.toHaveBeenCalled();
    });
});
