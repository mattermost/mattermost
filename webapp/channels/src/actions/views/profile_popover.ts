// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getChannelMember} from 'mattermost-redux/actions/channels';
import {getTeamMember} from 'mattermost-redux/actions/teams';

import {getChannelMember as selectChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {getTeamMember as selectTeamMember} from 'mattermost-redux/selectors/entities/teams';

import {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

export function getMembershipForEntities(teamId: string, userId: string, channelId?: string) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const promises = [];

        if (!selectTeamMember(getState(), teamId, userId)) {
            promises.push(dispatch(getTeamMember(teamId, userId)));
        }

        if (channelId && !selectChannelMember(getState(), channelId, userId)) {
            promises.push(dispatch(getChannelMember(channelId, userId)));
        }

        return Promise.all(promises);
    };
}
