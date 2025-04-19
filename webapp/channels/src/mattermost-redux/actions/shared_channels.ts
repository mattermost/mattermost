// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

import {ActionFunc} from 'mattermost-redux/types/actions';
import {getSharedChannels, receivedSharedChannelsWithRemotes} from './helpers';

export function fetchSharedChannelsWithRemotes(teamId: string, page = 0, perPage = 50): ActionFunc {
    return async (dispatch) => {
        let data;
        try {
            data = await Client4.getSharedChannels(teamId, page, perPage);
        } catch (error) {
            // In case of failures, we just skip and don't update the shared channels
            return {error};
        }

        if (data) {
            dispatch(receivedSharedChannelsWithRemotes(data));
        }

        return {data};
    };
}

export default {
    fetchSharedChannelsWithRemotes,
};