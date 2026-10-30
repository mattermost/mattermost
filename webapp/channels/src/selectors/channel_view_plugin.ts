// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {createPluginErrorLog} from 'utils/plugin_error_log';

import type {GlobalState} from 'types/store';
import type {ChannelViewRegistration} from 'types/store/plugins';

const matcherErrorLog = createPluginErrorLog('ChannelView');

export const clearLoggedChannelViewErrors = matcherErrorLog.clear;

/**
 * First ChannelView registration whose matcher returns === true for this channel, or null.
 *
 * Not memoized: matchers receive the full Redux state, so the slices they depend on can't be
 * known here. Plugins with expensive matchers should memoize inside their own predicate.
 */
export function getChannelViewPluginComponent(
    state: GlobalState,
    channel?: Channel,
): ChannelViewRegistration | null {
    const regs = state.plugins.components.ChannelView;
    if (!channel || !regs?.length) {
        return null;
    }
    for (const reg of regs) {
        try {
            if (reg.matcher(state, channel) === true) {
                return reg;
            }
        } catch (err) {
            matcherErrorLog.logOnce(reg.pluginId, err);
        }
    }
    return null;
}
