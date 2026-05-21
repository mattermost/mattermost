// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {batchGetProfilesInGroupChannel} from 'mattermost-redux/actions/users';
import {getUserIdsInChannels} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import {makeUseEntity} from './useEntity';

/**
 * Returns a Set of user IDs in a given group channel. Those users are loaded from the server when needed.
 */
export const useUserIdsInGroupChannel = makeUseEntity<Set<UserProfile['id']>>({
    name: 'useUserIdsInGroupChannel',
    fetch: (channelId: string) => batchGetProfilesInGroupChannel(channelId),
    selector: (state: GlobalState, channelId: string) => {
        return getUserIdsInChannels(state)[channelId];
    },
});
