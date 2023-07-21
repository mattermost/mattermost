// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';

import {Permissions} from 'mattermost-redux/constants';

import {getChannel} from './channels';
import {haveIChannelPermission} from './roles';

export function canAddReactions(state: GlobalState, channelId: string) {
    const channel = getChannel(state, channelId);

    if (!channel || channel.delete_at > 0) {
        return false;
    }

    return haveIChannelPermission(state, channel.team_id, channelId, Permissions.ADD_REACTION);
}

export function canRemoveReactions(state: GlobalState, channelId: string) {
    const channel = getChannel(state, channelId);

    if (!channel || channel.delete_at > 0) {
        return false;
    }

    return haveIChannelPermission(state, channel.team_id, channelId, Permissions.REMOVE_REACTION);
}
