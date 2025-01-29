// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CurrentSearch} from '@mattermost/types/search';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getMyGroupMentionKeys} from 'mattermost-redux/selectors/entities/groups';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserMentionKeys} from 'mattermost-redux/selectors/entities/users';
import type {UserMentionKey} from 'mattermost-redux/selectors/entities/users';

export const getCurrentSearchForCurrentTeam: (state: GlobalState) => CurrentSearch = createSelector(
    'getCurrentSearchForCurrentTeam',
    (state: GlobalState) => state.entities.search.current,
    getCurrentTeamId,
    (current: Record<string, CurrentSearch>, teamId: string) => {
        return current[teamId];
    },
);

export const getAllUserMentionKeys: (state: GlobalState) => UserMentionKey[] = createSelector(
    'getAllUserMentionKeys',
    getCurrentUserMentionKeys,
    (state: GlobalState) => getMyGroupMentionKeys(state, false),
    (userMentionKeys: UserMentionKey[], groupMentionKeys: UserMentionKey[]) => {
        return userMentionKeys.concat(groupMentionKeys);
    },
);

export function getOmniSearchResults(state: GlobalState) {
    return state.entities.search.omniSearchResults;
}
