// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

export function getSharedChannelsWithRemotes(state: GlobalState) {
    return state.entities?.sharedChannels?.sharedChannelsWithRemotes;
}

export function getRemoteNamesForChannel(state: GlobalState, channelId: string): string[] {
    return state.entities?.sharedChannels?.remoteNames?.[channelId] || [];
}

export const getRemoteInfoForChannel = createSelector(
    'getRemoteInfoForChannel',
    getSharedChannelsWithRemotes,
    (state: GlobalState, channelId: string) => channelId,
    (sharedChannelsWithRemotes: any, channelId: string) => {
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
