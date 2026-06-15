// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import CreateTeamModal from './create_team_modal';

const historyMock = (global as any).historyMock; // eslint-disable-line @typescript-eslint/no-explicit-any

const createdTeam = TestHelper.getTeamMock({id: 'new_team_id', name: 'my-new-team'});

describe('components/admin_console/create_team_modal/create_team_modal.tsx', () => {
    const baseProps = {
        onExited: jest.fn(),
        actions: {
            createTeam: jest.fn(() => Promise.resolve({data: createdTeam})),
            checkIfTeamExists: jest.fn(() => Promise.resolve({data: false})),
        },
    };

    test('should render the modal with team name and url fields', () => {
        renderWithContext(
            <CreateTeamModal {...baseProps}/>,
        );

        expect(screen.getByText('Create team', {selector: '.GenericModal__header h1'})).toBeInTheDocument();
        expect(screen.getByLabelText('Team name')).toBeInTheDocument();
        expect(screen.getByLabelText('Team URL')).toBeInTheDocument();
    });

    test('should auto-fill the url from the team name', async () => {
        renderWithContext(
            <CreateTeamModal {...baseProps}/>,
        );

        await userEvent.type(screen.getByLabelText('Team name'), 'My New Team');

        expect(screen.getByLabelText('Team URL')).toHaveValue('my-new-team');
    });

    test('should not create the team when the name is too short', async () => {
        const createTeam = jest.fn(() => Promise.resolve({data: TestHelper.getTeamMock({id: 'new_team_id', name: 'a'})}));
        renderWithContext(
            <CreateTeamModal
                {...baseProps}
                actions={{...baseProps.actions, createTeam}}
            />,
        );

        await userEvent.type(screen.getByLabelText('Team name'), 'a');
        await userEvent.click(screen.getByRole('button', {name: /Create team/i}));

        expect(createTeam).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText(/Name must be/i)).toBeInTheDocument();
        });
    });

    test('should create the team and navigate to the detail page on success', async () => {
        historyMock.push.mockClear();
        const createTeam = jest.fn(() => Promise.resolve({data: createdTeam}));
        const checkIfTeamExists = jest.fn(() => Promise.resolve({data: false}));

        renderWithContext(
            <CreateTeamModal
                {...baseProps}
                actions={{createTeam, checkIfTeamExists}}
            />,
        );

        await userEvent.type(screen.getByLabelText('Team name'), 'My New Team');
        await userEvent.click(screen.getByRole('button', {name: /Create team/i}));

        await waitFor(() => {
            expect(createTeam).toHaveBeenCalledTimes(1);
            expect(createTeam).toHaveBeenCalledWith(expect.objectContaining({
                type: 'O',
                display_name: 'My New Team',
                name: 'my-new-team',
            }));
            expect(historyMock.push).toHaveBeenCalledWith('/admin_console/user_management/teams/new_team_id');
        });
    });

    test('should show an error when the team url already exists', async () => {
        const createTeam = jest.fn(() => Promise.resolve({data: createdTeam}));
        const checkIfTeamExists = jest.fn(() => Promise.resolve({data: true}));

        renderWithContext(
            <CreateTeamModal
                {...baseProps}
                actions={{createTeam, checkIfTeamExists}}
            />,
        );

        await userEvent.type(screen.getByLabelText('Team name'), 'My New Team');
        await userEvent.click(screen.getByRole('button', {name: /Create team/i}));

        expect(createTeam).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText(/This URL is taken or unavailable/i)).toBeInTheDocument();
        });
    });
});
