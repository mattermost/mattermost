// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {findMatchingRegistration} from 'utils/channel_matchers';
import {createPluginErrorLog} from 'utils/plugin_error_log';

import type {GlobalState} from 'types/store';
import type {ChannelIntroRegistration} from 'types/store/plugins';

const matcherErrorLog = createPluginErrorLog('ChannelIntro');

export const clearLoggedChannelIntroErrors = matcherErrorLog.clear;

/** First registration whose matcher returns === true for this channel, or null. */
export function getChannelIntroOverride(
    state: GlobalState,
    channelId: string,
): ChannelIntroRegistration | null {
    const regs = state.plugins.components.ChannelIntro;
    if (!channelId || !regs?.length) {
        return null;
    }
    const channel = state.entities?.channels?.channels?.[channelId];
    if (!channel) {
        return null;
    }
    return findMatchingRegistration(state, channel, regs, matcherErrorLog) ?? null;
}
