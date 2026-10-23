// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {createPluginErrorLog} from 'utils/plugin_error_log';

import type {GlobalState} from 'types/store';
import type {ChannelKind} from 'types/store/plugins';

const matcherErrorLog = createPluginErrorLog('ChannelKind');

/** Clears the log-once tracker for matcher errors, for one plugin or all; called when a plugin registers. */
export const clearLoggedChannelKindErrors = matcherErrorLog.clear;

/**
 * The kind of channel this is, which decides the words the webapp uses for it: 'board' for a
 * channel a plugin registered as a board (registerChannelKind), otherwise undefined, a channel.
 * The first registration whose matcher accepts the channel wins.
 *
 * Iterates the matchers on every call, as the icon override does: they take the whole state, so
 * what they read can't be known. A plugin with an expensive matcher should memoize it itself.
 */
export function getChannelKind(state: GlobalState, channel?: Pick<Channel, 'id'> | null): ChannelKind | undefined {
    if (!channel) {
        return undefined;
    }
    for (const entry of state.plugins.components.ChannelKind ?? []) {
        try {
            if (entry.matcher(state, channel as Channel) === true) {
                return entry.kind;
            }
        } catch (err) {
            matcherErrorLog.logOnce(entry.pluginId, err);
        }
    }
    return undefined;
}

/** Whether the channel is a board, for which the webapp says "board" where it would say "channel". */
export function isBoardChannel(state: GlobalState, channel?: Pick<Channel, 'id'> | null): boolean {
    return getChannelKind(state, channel) === 'board';
}
