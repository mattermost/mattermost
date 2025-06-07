// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RemoteCluster} from '@mattermost/types/remote_clusters';
import type {GlobalState} from '@mattermost/types/store';

import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {ActionTypes} from '../reducers/entities/remote_clusters';

export function receivedRemoteClusters(remoteClusters: RemoteCluster[]) {
    return {
        type: ActionTypes.RECEIVED_REMOTE_CLUSTERS,
        data: remoteClusters,
    };
}

export function fetchRemoteClusters(): ActionFuncAsync<RemoteCluster[]> {
    return async (dispatch: any, getState: () => GlobalState) => {
        // Check if we already have the data in the Redux store
        const state = getState();
        const remoteClusters = state.entities?.remoteClusters;

        // If we already have the data, no need to fetch it again
        if (remoteClusters && Object.keys(remoteClusters).length > 0) {
            return {data: Object.values(remoteClusters)};
        }

        let data;
        try {
            data = await Client4.getRemoteClusters({excludePlugins: false});
        } catch (error) {
            // In case of failures, we just skip and don't update the remote data
            return {error};
        }

        if (data) {
            dispatch(receivedRemoteClusters(data));
        }

        return {data};
    };
}
