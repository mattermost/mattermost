// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {General} from 'mattermost-redux/constants';

import {TestHelper} from 'utils/test_helper';

const emptyOtherUsersState: Omit<GlobalState['entities']['users'], 'profiles' | 'currentUserId'> = {
    isManualStatus: {},
    mySessions: [],
    myAudits: [],
    profilesInTeam: {},
    profilesNotInTeam: {},
    profilesWithoutTeam: new Set(),
    profilesInChannel: {},
    profilesNotInChannel: {},
    profilesInGroup: {},
    profilesNotInGroup: {},
    statuses: {},
    stats: {},
    filteredStats: {},
    myUserAccessTokens: {},
    lastActivity: {},
    dndEndTimes: {},
};

export const adminUsersState: () => GlobalState['entities']['users'] = () => ({
    ...emptyOtherUsersState,
    currentUserId: 'current_user_id',
    profiles: {
        current_user_id: {
            ...TestHelper.getUserMock({id: 'current_user_id'}),
            roles: General.SYSTEM_ADMIN_ROLE,
        },
    },
});

export const endUsersState: () => GlobalState['entities']['users'] = () => ({
    ...emptyOtherUsersState,
    currentUserId: 'current_user_id',
    profiles: {
        current_user_id: {
            ...TestHelper.getUserMock({id: 'current_user_id'}),
            roles: General.CHANNEL_USER_ROLE,
        },
    },
});
