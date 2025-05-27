// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RemoteClusterInfo} from '@mattermost/types/shared_channels';
import type {GlobalState} from '@mattermost/types/store';

export function getRemoteNamesForChannel(state: GlobalState, channelId: string): string[] {
    const remotes = state.entities?.sharedChannels?.remotes?.[channelId];
    if (remotes && remotes.length > 0) {
        return remotes.map((remote: RemoteClusterInfo) => remote.display_name);
    }
    return [];
}

export function getRemotesForChannel(state: GlobalState, channelId: string): RemoteClusterInfo[] {
    return state.entities?.sharedChannels?.remotes?.[channelId] || [];
}

export function getRemoteClusterInfo(state: GlobalState, remoteId: string): RemoteClusterInfo | null {
    return state.entities?.sharedChannels?.remotesByRemoteId?.[remoteId] || null;
}

export function getRemoteDisplayName(state: GlobalState, remoteId: string): string | null {
    const remote = getRemoteClusterInfo(state, remoteId);
    return remote?.display_name || null;
}
