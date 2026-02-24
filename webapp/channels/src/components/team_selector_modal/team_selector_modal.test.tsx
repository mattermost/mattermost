// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';

import {renderWithContext, screen, waitFor, act} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamSelectorModal from './team_selector_modal';
import type {Props} from './team_selector_modal';

describe('components/TeamSelectorModal', () => {
    // Flush any pending requestAnimationFrame callbacks between tests
    afterEach(async () => {
        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });
    });

    const defaultProps: Props = {
        alreadySelected: ['id1'],
        intl: {} as IntlShape,
        searchTerm: '',
        teams: [
            TestHelper.getTeamMock({
                id: 'id1',
                delete_at: 0,
                scheme_id: '',
                display_name: 'Team 1',
            }),
            TestHelper.getTeamMock({
                id: 'id2',
                delete_at: 123,
                scheme_id: '',
                display_name: 'Team 2',
            }),
            TestHelper.getTeamMock({
                id: 'id3',
                delete_at: 0,
                scheme_id: 'test',
                display_name: 'Team 3',
            }),
            TestHelper.getTeamMock({
                id: 'id4',
                delete_at: 0,
                scheme_id: '',
                display_name: 'Team 4',
                group_constrained: false,
            }),
            TestHelper.getTeamMock({
                id: 'id5',
                delete_at: 0,
                scheme_id: '',
                display_name: 'Team 5',
                group_constrained: true,
            }),
        ],
        onModalDismissed: jest.fn(),
        onTeamsSelected: jest.fn(),
        actions: {
            loadTeams: jest.fn().mockResolvedValue({data: []}),
            setModalSearchTerm: jest.fn(() => Promise.resolve()),
            searchTeams: jest.fn(() => Promise.resolve()),
        },
    };

    test('should render available teams excluding already selected and deleted teams', async () => {
        renderWithContext(<TeamSelectorModal {...defaultProps}/>);

        // Wait for all expected teams to be visible (Team 1 is already selected, Team 2 is deleted)
        await waitFor(() => {
            expect(screen.getByText('Team 3')).toBeInTheDocument();
            expect(screen.getByText('Team 4')).toBeInTheDocument();
            expect(screen.getByText('Team 5')).toBeInTheDocument();
        });

        // Verify filtered teams are not shown
        expect(screen.queryByText('Team 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Team 2')).not.toBeInTheDocument();
    });

    test('should hide group constrained teams when excludeGroupConstrained is true', async () => {
        renderWithContext(
            <TeamSelectorModal
                {...defaultProps}
                excludeGroupConstrained={true}
            />,
        );

        // Wait for all expected teams (Team 1 is already selected, Team 2 is deleted, Team 5 is group constrained)
        await waitFor(() => {
            expect(screen.getByText('Team 3')).toBeInTheDocument();
            expect(screen.getByText('Team 4')).toBeInTheDocument();
            expect(screen.queryByText('Team 5')).not.toBeInTheDocument();
        });

        // Verify filtered teams are not shown
        expect(screen.queryByText('Team 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Team 2')).not.toBeInTheDocument();
    });
});
