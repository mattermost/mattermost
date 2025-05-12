// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {RemoteCluster} from '@mattermost/types/remote_clusters';

export const ActionTypes = {
    RECEIVED_REMOTE_CLUSTERS: 'RECEIVED_REMOTE_CLUSTERS',
};

function remoteClusters(state: Record<string, RemoteCluster> = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_REMOTE_CLUSTERS: {
        const remoteClusters = action.data as RemoteCluster[];
        const newState = {...state};

        // Index by remote_id for easier lookup
        remoteClusters.forEach((cluster) => {
            newState[cluster.remote_id] = cluster;
        });

        return newState;
    }
    default:
        return state;
    }
}

// Export the reducer directly without combining
export default remoteClusters;
