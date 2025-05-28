// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import semver from 'semver';

import type {CallsConfig, UserSessionState} from '@mattermost/calls-common/lib/types';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {suitePluginIds} from 'utils/constants';

import type {GlobalState} from 'types/store';

const CALLS_PLUGIN = `plugins-${suitePluginIds.calls}`;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const pluginState = (state: GlobalState) => state[CALLS_PLUGIN];

export function isCallsEnabled(state: GlobalState, minVersion = '0.4.2') {
    return Boolean(state.plugins.plugins[suitePluginIds.calls] &&
        semver.gte(String(semver.clean(state.plugins.plugins[suitePluginIds.calls].version || '0.0.0')), minVersion));
}

// isCallsRingingEnabledOnServer is the flag for the ringing/notification feature in calls
export function isCallsRingingEnabledOnServer(state: GlobalState) {
    return Boolean(pluginState(state)?.callsConfig?.EnableRinging);
}

export const getSessionsInCalls = createSelector(
    'getSessionsInCalls',
    pluginState,
    (state): Record<string, Record<string, UserSessionState>> => {
        return state?.sessions || {};
    },
);

export const getCallsConfig = createSelector(
    'getCallsConfig',
    pluginState,
    (state): CallsConfig => {
        return state?.callsConfig || {};
    },
);

export function getCallsChannelState(state: GlobalState, channelId: string): {enabled?: boolean} {
    const callsState = pluginState(state);

    if (!callsState || !callsState.channels || !callsState.channels[channelId]) {
        return {};
    }

    return callsState.channels[channelId];
}

export function callsChannelExplicitlyEnabled(state: GlobalState, channelId: string) {
    return Boolean(getCallsChannelState(state, channelId).enabled);
}

export function callsChannelExplicitlyDisabled(state: GlobalState, channelId: string) {
    const enabled = getCallsChannelState(state, channelId).enabled;
    return (typeof enabled !== 'undefined') && !enabled;
}
