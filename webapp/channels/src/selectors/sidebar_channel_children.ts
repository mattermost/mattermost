// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {findMatchingRegistrations} from 'utils/channel_matchers';
import {createPluginErrorLog} from 'utils/plugin_error_log';

import type {GlobalState} from 'types/store';
import type {SidebarChannelChildrenRegistration} from 'types/store/plugins';

const matcherErrorLog = createPluginErrorLog('SidebarChannelChildren');

const renderErrorLog = createPluginErrorLog('SidebarChannelChildren', {
    subject: 'component',
    outcome: 'hiding it',
});

export const logSidebarChannelChildrenRenderError = renderErrorLog.logOnce;

/** Lets a plugin's next matcher or render error be logged again, e.g. when it re-registers. */
export function clearLoggedSidebarChannelChildrenErrors(pluginId?: string) {
    matcherErrorLog.clear(pluginId);
    renderErrorLog.clear(pluginId);
}

const NO_REGISTRATIONS: SidebarChannelChildrenRegistration[] = [];

/**
 * Every SidebarChannelChildren registration whose matcher returns === true for this channel.
 *
 * Not memoized: matchers receive the full Redux state, so the slices they depend on can't be known
 * here. Callers should compare the result shallowly, and plugins with expensive matchers should
 * memoize inside their own predicate.
 */
export function getSidebarChannelChildrenRegistrations(
    state: GlobalState,
    channel?: Channel,
): SidebarChannelChildrenRegistration[] {
    const registrations = state.plugins.components.SidebarChannelChildren;
    if (!channel || !registrations?.length) {
        return NO_REGISTRATIONS;
    }

    const matching = findMatchingRegistrations(state, channel, registrations, matcherErrorLog);
    return matching.length ? matching : NO_REGISTRATIONS;
}
