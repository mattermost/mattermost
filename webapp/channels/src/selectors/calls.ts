// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import semver from 'semver';

import type {CallsConfig, UserSessionState} from '@mattermost/calls-common/lib/types';

import {suitePluginIds} from 'utils/constants';

import type {GlobalState} from 'types/store';

const CALLS_PLUGIN = 'plugins-com.mattermost.calls';

export function isCallsEnabled(state: GlobalState, minVersion = '0.4.2') {
    return Boolean(state.plugins.plugins[suitePluginIds.calls] &&
        semver.gte(String(semver.clean(state.plugins.plugins[suitePluginIds.calls].version || '0.0.0')), minVersion));
}

// isCallsRingingEnabledOnServer is the flag for the ringing/notification feature in calls
export function isCallsRingingEnabledOnServer(state: GlobalState) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return Boolean(state[`plugins-${suitePluginIds.calls}`]?.callsConfig?.EnableRinging);
}

export function getSessionsInCalls(state: GlobalState): Record<string, Record<string, UserSessionState>> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return state[CALLS_PLUGIN].sessions || {};
}

export function getCallsConfig(state: GlobalState): CallsConfig {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return state[CALLS_PLUGIN].callsConfig;
}
