// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamSelectorModal from './team_selector_modal';
import type {Props} from './team_selector_modal';

describe('components/TeamSelectorModal', () => {
    const defaultProps: Props = {
        currentSchemeId: 'xxx',
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
        onModalDismissed: vi.fn(),
        onTeamsSelected: vi.fn(),
        actions: {
            loadTeams: vi.fn().mockResolvedValue({data: []}),
            setModalSearchTerm: vi.fn(() => Promise.resolve()),
            searchTeams: vi.fn(() => Promise.resolve()),
        },
    };

    afterEach(() => {
        vi.clearAllTimers();
    });

    test('should match snapshot', async () => {
        renderWithContext(<TeamSelectorModal {...defaultProps}/>);

        // Modal should be shown with title
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Should show teams that are not already selected and not deleted
        // Team 1 (id1) is already selected, Team 2 (id2) is deleted
        // So we should see Team 3, Team 4, and Team 5
        expect(screen.getByText('Team 3')).toBeInTheDocument();
        expect(screen.getByText('Team 4')).toBeInTheDocument();
        expect(screen.getByText('Team 5')).toBeInTheDocument();

        // Team 1 is already selected, so it shouldn't appear in the list
        expect(screen.queryByText('Team 1')).not.toBeInTheDocument();

        // Team 2 is deleted, so it shouldn't appear
        expect(screen.queryByText('Team 2')).not.toBeInTheDocument();
    });

    test('should hide group constrained teams when excludeGroupConstrained is true', async () => {
        renderWithContext(
            <TeamSelectorModal
                {...defaultProps}
                excludeGroupConstrained={true}
            />,
        );

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Team 5 is group constrained, so it should be hidden
        expect(screen.queryByText('Team 5')).not.toBeInTheDocument();

        // Team 4 is not group constrained, so it should still be visible
        expect(screen.getByText('Team 4')).toBeInTheDocument();

        // Team 3 has no group_constrained property, so it should be visible
        expect(screen.getByText('Team 3')).toBeInTheDocument();
    });
});
