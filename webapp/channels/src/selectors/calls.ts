// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'types/store';
import {PostTypes, suitePluginIds} from 'utils/constants';
import semver from 'semver';
import {Post} from '@mattermost/types/src/posts';
import {Channel} from '@mattermost/types/src/channels';
import {General} from 'mattermost-redux/constants';

export function isCallsEnabled(state: GlobalState, minVersion = '0.4.2') {
    return Boolean(state.plugins.plugins[suitePluginIds.calls] &&
        semver.gte(state.plugins.plugins[suitePluginIds.calls].version || '0.0.0', minVersion));
}

// isCallsRingingEnabledOnServer is the flag for the ringing/notification feature in calls
export function isCallsRingingEnabledOnServer(state: GlobalState) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return Boolean(state[`plugins-${suitePluginIds.calls}`]?.callsConfig?.EnableRinging);
}

function isDmGmChannel(channelType: Channel['type']) {
    return channelType === General.DM_CHANNEL || channelType === General.GM_CHANNEL;
}

export function callsWillNotify(state: GlobalState, post: Post, channel: Channel): boolean {
    // Calls will notify if:
    //  1. it's a custom_calls post (call has started)
    //  2. in a DM or GM channel
    //  3. calls is enabled and is v0.17.0+
    //  4. calls ringing is enabled on the server
    return post.type === PostTypes.CUSTOM_CALLS &&
        isDmGmChannel(channel.type) &&
        isCallsEnabled(state, '0.17.0') &&
        isCallsRingingEnabledOnServer(state);
}
