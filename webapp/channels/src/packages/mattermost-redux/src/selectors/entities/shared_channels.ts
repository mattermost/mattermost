// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RemoteCluster} from '@mattermost/types/remote_clusters';
import type {GlobalState} from '@mattermost/types/store';

export function getAllRemoteClusters(state: GlobalState): RemoteCluster[] {
    return state.entities?.remoteClusters ?
        Object.values(state.entities.remoteClusters) :
        [];
}

export function getRemoteClusterById(state: GlobalState, remoteId: string): RemoteCluster | undefined {
    return state.entities?.remoteClusters?.[remoteId];
}
