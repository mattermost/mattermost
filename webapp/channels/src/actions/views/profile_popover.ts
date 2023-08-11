// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getChannelMember} from 'mattermost-redux/actions/channels';
import {getTeamMember} from 'mattermost-redux/actions/teams';
import type {DispatchFunc} from 'mattermost-redux/types/actions';

export function getMembershipForEntities(teamId: string, userId: string, channelId?: string) {
    return (dispatch: DispatchFunc) => {
        return Promise.all([
            dispatch(getTeamMember(teamId, userId)),
            channelId && dispatch(getChannelMember(channelId, userId)),
        ]);
    };
}
