// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import {findMatchingRegistration} from 'utils/channel_matchers';
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

// The kind worked out for each stored channel, kept until the channel or the registrations change,
// so the matchers don't run again for every sidebar row and post on every store update.
const kindsByChannel = new WeakMap<Channel, {registrations: ChannelKindRegistration[]; kind: ChannelKind}>();

/**
 * The kind of channel this is, which picks the words the webapp uses for it: the kind of the first
 * registration (registerChannelKind) whose matcher accepts the channel, otherwise 'channel'.
 *
 * The matcher gets the stored channel, and its answer is kept until that channel or the
 * registrations change. For a channel not in the store yet, it gets what the caller passed and its
 * answer isn't kept, so the kind is worked out again once the channel loads.
 */
export function getChannelKind(state: GlobalState, channel?: Pick<Channel, 'id'> | null): ChannelKind {
    const registrations = state.plugins.components.ChannelKind;
    if (!channel || !registrations?.length) {
        return 'channel';
    }

    const stored = state.entities?.channels?.channels?.[channel.id];
    if (!stored) {
        return matchChannelKind(state, registrations, channel as Channel);
    }

    const cached = kindsByChannel.get(stored);
    if (cached?.registrations === registrations) {
        return cached.kind;
    }
    const kind = matchChannelKind(state, registrations, stored);
    kindsByChannel.set(stored, {registrations, kind});
    return kind;
}

function matchChannelKind(state: GlobalState, registrations: ChannelKindRegistration[], channel: Channel): ChannelKind {
    return findMatchingRegistration(state, channel, registrations, matcherErrorLog)?.kind ?? 'channel';
}
