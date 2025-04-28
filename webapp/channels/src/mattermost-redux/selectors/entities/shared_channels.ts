// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import {GlobalState} from 'mattermost-redux/types/store';
import {RemoteClusterInfo} from 'mattermost-redux/types/shared_channels';

export function getSharedChannelsWithRemotes(state: GlobalState) {
    return state.entities.sharedChannels.sharedChannelsWithRemotes;
}

export const getRemoteNamesForChannel = createSelector(
    'getRemoteNamesForChannel',
    getSharedChannelsWithRemotes,
    (state: GlobalState, channelId: string) => channelId,
    (sharedChannelsWithRemotes, channelId) => {
        if (!channelId || !sharedChannelsWithRemotes) {
            return [];
        }

        const data = sharedChannelsWithRemotes[channelId];
        if (!data || !data.remotes || !Array.isArray(data.remotes)) {
            return [];
        }

        return data.remotes.map((remote: RemoteClusterInfo) => remote.display_name || remote.name);
    },
);

export const getRemoteInfoForChannel = createSelector(
    'getRemoteInfoForChannel',
    getSharedChannelsWithRemotes,
    (state: GlobalState, channelId: string) => channelId,
    (sharedChannelsWithRemotes, channelId) => {
        if (!channelId || !sharedChannelsWithRemotes) {
            return [];
        }

        const data = sharedChannelsWithRemotes[channelId];
        if (!data || !data.remotes || !Array.isArray(data.remotes)) {
            return [];
        }
        
        return data.remotes;
    },
);