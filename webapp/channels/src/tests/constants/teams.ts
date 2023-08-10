// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import type {TeamsState} from '@mattermost/types/teams';

export const emptyTeams: () => TeamsState = () => ({
    currentTeamId: 'current_team_id',
    teams: {
        current_team_id: TestHelper.getTeamMock({id: 'current_team_id'}),
    },
    myMembers: {},
    membersInTeam: {},
    stats: {},
    groupsAssociatedToTeam: {},
    totalCount: 0,
});
