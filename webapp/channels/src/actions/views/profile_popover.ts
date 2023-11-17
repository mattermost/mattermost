// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getChannelMember} from 'mattermost-redux/actions/channels';
import {getTeamMember} from 'mattermost-redux/actions/teams';
import type {ActionFunc} from 'mattermost-redux/types/actions';

export function getMembershipForEntities(teamId: string, userId: string, channelId?: string): ActionFunc {
    return async (dispatch) => {
        await Promise.all([
            dispatch(getTeamMember(teamId, userId)),
            channelId && dispatch(getChannelMember(channelId, userId)),
        ]);

        return {data: true};
    };
}
