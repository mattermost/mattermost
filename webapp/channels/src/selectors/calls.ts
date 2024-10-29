// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import semver from 'semver';

import type {CallsConfig, UserSessionState} from '@mattermost/calls-common/lib/types';

import {suitePluginIds} from 'utils/constants';

import type {GlobalState} from 'types/store';

const CALLS_PLUGIN = `plugins-${suitePluginIds.calls}`;

export function isCallsEnabled(state: GlobalState, minVersion = '0.4.2') {
    return Boolean(state.plugins.plugins[suitePluginIds.calls] &&
        semver.gte(String(semver.clean(state.plugins.plugins[suitePluginIds.calls].version || '0.0.0')), minVersion));
}

// isCallsRingingEnabledOnServer is the flag for the ringing/notification feature in calls
export function isCallsRingingEnabledOnServer(state: GlobalState) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return Boolean(state[CALLS_PLUGIN]?.callsConfig?.EnableRinging);
}

export function getSessionsInCalls(state: GlobalState): Record<string, Record<string, UserSessionState>> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return state[CALLS_PLUGIN]?.sessions || {};
}

export function getCallsConfig(state: GlobalState): CallsConfig {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return state[CALLS_PLUGIN]?.callsConfig;
}

export function getCallsChannelState(state: GlobalState, channelId: string): {enabled?: boolean} {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (!state[CALLS_PLUGIN] || !state[CALLS_PLUGIN].channels) {
        return {};
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return state[CALLS_PLUGIN].channels[channelId] || {};
}

export function callsChannelExplicitlyEnabled(state: GlobalState, channelId: string) {
    return Boolean(getCallsChannelState(state, channelId).enabled);
}

export function callsChannelExplicitlyDisabled(state: GlobalState, channelId: string) {
    const enabled = getCallsChannelState(state, channelId).enabled;
    return (typeof enabled !== 'undefined') && !enabled;
}
