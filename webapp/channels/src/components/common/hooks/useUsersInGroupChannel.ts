// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {getProfilesInGroupChannels} from 'mattermost-redux/actions/users';
import {makeGetProfilesInChannel} from 'mattermost-redux/selectors/entities/users';

import {makeUseEntity} from './useEntity';

export const useUsersInGroupChannel = makeUseEntity<UserProfile[], Channel['id']>({
    name: 'useUser',
    fetch: (channelId) => getProfilesInGroupChannels([channelId]),
    selectorFactory: () => {
        const getProfilesInChannel = makeGetProfilesInChannel();

        return (state, channelId) => {
            // getProfilesInChannel defaults to returning an empty array when nothing is loaded, but we need to
            // return undefined so that makeUseEntity can tell the difference between when the list hasn't been loaded
            // versus when it's loaded and empty
            return state.entities.users.profilesInChannel[channelId] ? getProfilesInChannel(state, channelId) : undefined;
        };
    },
});
