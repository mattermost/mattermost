// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import {createPluginErrorLog} from 'utils/plugin_error_log';

import type {GlobalState} from 'types/store';
import type {ChannelKind, ChannelKindRegistration} from 'types/store/plugins';

/**
 * One message per channel kind, so a component names a channel with `messages.leave[kind]` rather
 * than switching on the kind. Each is its own translated message with its own id; TypeScript
 * requires one for every kind. Build each entry with defineMessage so i18n-extract finds it.
 */
export type KindMessages = Record<ChannelKind, MessageDescriptor>;

const matcherErrorLog = createPluginErrorLog('ChannelKind');

/** Clears the log-once tracker for matcher errors, for one plugin or all; called when a plugin registers. */
export const clearLoggedChannelKindErrors = matcherErrorLog.clear;

// The kinds worked out for each store state, so the matchers run once per channel per state
// however many components (every post, for post_markdown) ask about the same channel.
const kindsByState = new WeakMap<GlobalState, Map<string, ChannelKind>>();

/**
 * The kind of channel this is, which picks the words the webapp uses for it: the kind of the first
 * registration (registerChannelKind) whose matcher accepts the channel, otherwise 'channel'.
 *
 * The matchers take the whole state, so what they read can't be known; the result is kept for the
 * state it was worked out from and worked out again once the state changes.
 */
export function getChannelKind(state: GlobalState, channel?: Pick<Channel, 'id'> | null): ChannelKind {
    const registrations = state.plugins.components.ChannelKind;
    if (!channel || !registrations?.length) {
        return 'channel';
    }

    let kinds = kindsByState.get(state);
    if (!kinds) {
        kinds = new Map();
        kindsByState.set(state, kinds);
    }
    let kind = kinds.get(channel.id);
    if (!kind) {
        kind = matchChannelKind(state, registrations, channel);
        kinds.set(channel.id, kind);
    }
    return kind;
}

function matchChannelKind(state: GlobalState, registrations: ChannelKindRegistration[], channel: Pick<Channel, 'id'>): ChannelKind {
    // Callers that only have the id pass {id}; the matcher is promised a whole channel.
    const fullChannel = state.entities?.channels?.channels?.[channel.id] ?? channel as Channel;
    for (const entry of registrations) {
        try {
            if (entry.matcher(state, fullChannel) === true) {
                return entry.kind;
            }
        } catch (err) {
            matcherErrorLog.logOnce(entry.pluginId, err);
        }
    }
    return 'channel';
}
