// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getMyGroupMentionKeys} from 'mattermost-redux/selectors/entities/groups';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserMentionKeys, UserMentionKey} from 'mattermost-redux/selectors/entities/users';

export const getCurrentSearchForCurrentTeam: (state: GlobalState) => string = createSelector(
    'getCurrentSearchForCurrentTeam',
    (state: GlobalState) => state.entities.search.current,
    getCurrentTeamId,
    (current, teamId) => {
        return current[teamId];
    },
);

export const getAllUserMentionKeys: (state: GlobalState) => UserMentionKey[] = createSelector(
    'getAllUserMentionKeys',
    getCurrentUserMentionKeys,
    getMyGroupMentionKeys,
    (userMentionKeys, groupMentionKeys) => {
        return userMentionKeys.concat(groupMentionKeys);
    },
);
