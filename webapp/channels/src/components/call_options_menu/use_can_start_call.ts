// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getUser} from 'mattermost-redux/selectors/entities/users';
import {isSystemAdmin} from 'mattermost-redux/utils/user_utils';

import {
    callsChannelExplicitlyDisabled,
    callsChannelExplicitlyEnabled,
    getCallsConfig,
    isCallsEnabled,
} from 'selectors/calls';

import type {GlobalState} from 'types/store';

export function canStartCall(state: GlobalState, channelId: string, currentUserId: string): boolean {
    // 1. No one gets a call button if the plugin is disabled.
    if (!isCallsEnabled(state)) {
        return false;
    }

    // 2. No one gets it if calls have been explicitly disabled in the channel.
    if (callsChannelExplicitlyDisabled(state, channelId)) {
        return false;
    }

    // 3. Admins get it unless calls have been explicitly disabled in the channel, test mode
    // (DefaultEnabled = false) included.
    if (isSystemAdmin(getUser(state, currentUserId)?.roles)) {
        return true;
    }

    // 4. Users only get it if test mode is off and calls in the channel are not disabled.
    if (getCallsConfig(state).DefaultEnabled) {
        return true;
    }

    // 5. Everyone gets it if calls have been explicitly enabled in the channel, regardless of test mode.
    return callsChannelExplicitlyEnabled(state, channelId);
}

export default function useCanStartCall(channelId: string, currentUserId: string, enabled = true): boolean {
    return useSelector((state: GlobalState) => enabled && canStartCall(state, channelId, currentUserId));
}
