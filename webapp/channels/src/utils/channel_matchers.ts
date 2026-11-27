// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import type {PluginErrorLog} from 'utils/plugin_error_log';

import type {GlobalState} from 'types/store';

type ChannelMatcherRegistration = {
    pluginId: string;
    matcher: (state: GlobalState, channel: Channel) => boolean;
};

/**
 * Every registration whose matcher returns true for the channel, in the order of the given registrations. A matcher that
 * throws counts as no match, and only the first throw from each plugin is logged.
 */
export function findMatchingRegistrations<T extends ChannelMatcherRegistration>(
    state: GlobalState,
    channel: Channel,
    registrations: readonly T[] | undefined,
    errorLog: PluginErrorLog,
): T[] {
    const matching: T[] = [];
    for (const registration of registrations ?? []) {
        try {
            if (registration.matcher(state, channel) === true) {
                matching.push(registration);
            }
        } catch (err) {
            errorLog.logOnce(registration.pluginId, err);
        }
    }
    return matching;
}

/**
 * The first registration whose matcher returns true for the channel. A matcher that throws counts
 * as no match, and only the first throw from each plugin is logged.
 */
export function findMatchingRegistration<T extends ChannelMatcherRegistration>(
    state: GlobalState,
    channel: Channel,
    registrations: readonly T[] | undefined,
    errorLog: PluginErrorLog,
): T | undefined {
    for (const registration of registrations ?? []) {
        try {
            if (registration.matcher(state, channel) === true) {
                return registration;
            }
        } catch (err) {
            errorLog.logOnce(registration.pluginId, err);
        }
    }
    return undefined;
}
