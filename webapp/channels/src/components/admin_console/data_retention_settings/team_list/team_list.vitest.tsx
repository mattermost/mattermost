// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import type {Team} from '@mattermost/types/teams';

import TeamList from 'components/admin_console/data_retention_settings/team_list/team_list';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/admin_console/data_retention_settings/team_list', () => {
    const team: Team = Object.assign(TestHelper.getTeamMock({id: 'team-1'}));

    test('should match snapshot', () => {
        const testTeams = [{
            ...team,
        }];
        const actions = {
            getDataRetentionCustomPolicyTeams: vi.fn().mockResolvedValue(testTeams),
            searchTeams: vi.fn(),
            setTeamListSearch: vi.fn(),
            setTeamListFilters: vi.fn(),
        };
        const {container} = renderWithContext(
            <TeamList
                searchTerm=''
                onRemoveCallback={vi.fn()}
                onAddCallback={vi.fn()}
                teamsToRemove={{}}
                teamsToAdd={{}}
                teams={testTeams}
                totalCount={testTeams.length}
                actions={actions}
            />);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with paging', () => {
        const testTeams = [];
        for (let i = 0; i < 30; i++) {
            testTeams.push({
                ...team,
                id: 'id' + i,
                display_name: 'DN' + i,
            });
        }

        const actions = {
            getDataRetentionCustomPolicyTeams: vi.fn().mockResolvedValue(testTeams),
            searchTeams: vi.fn(),
            setTeamListSearch: vi.fn(),
            setTeamListFilters: vi.fn(),
        };
        const {container} = renderWithContext(
            <TeamList
                searchTerm=''
                onRemoveCallback={vi.fn()}
                onAddCallback={vi.fn()}
                teamsToRemove={{}}
                teamsToAdd={{}}
                teams={testTeams}
                totalCount={testTeams.length}
                actions={actions}
            />);
        expect(container).toMatchSnapshot();
    });
});
