// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RemoteCluster} from '@mattermost/types/remote_clusters';
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

export function getAllRemoteClusters(state: GlobalState): RemoteCluster[] {
    return state.entities?.remoteClusters ?
        Object.values(state.entities.remoteClusters) :
        [];
}

export function getRemoteClusterById(state: GlobalState, remoteId: string): RemoteCluster | undefined {
    return state.entities?.remoteClusters?.[remoteId];
}
