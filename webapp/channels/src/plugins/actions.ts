// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogLevel} from '@mattermost/types/client4';
import type {PluginManifest} from '@mattermost/types/plugins';

import {Client4} from 'mattermost-redux/client';

import {hideRHSPlugin as hideRHSPluginAction} from 'actions/views/rhs';
import {getPluggableId} from 'selectors/rhs';

import {ActionTypes} from 'utils/constants';

import type {GlobalState, ActionFunc, ActionFuncAsync} from 'types/store';

export function logPluginLoadFailure(manifest: PluginManifest, reason: 'load' | 'execution' | 'initialization' | 'timeout', error: unknown): ActionFuncAsync<boolean> {
    return async () => {
        try {
            // Sample 5% of failures to limit reports from clients loading the same plugin.
            if (Client4.enableLogging && Math.random() < 0.05) {
                const summary = error instanceof Error ? error.message : 'unknown';
                const message = `plugin_load_failed plugin_id=${manifest.id} plugin_version=${manifest.version} reason=${reason} error=${summary}`;
                await Client4.logClientError(message.replace(/[^\x20-\x7E]/g, ' ').slice(0, 399), LogLevel.Error);
            }
        } catch {
            // Reporting a failed plugin must not prevent the app from loading.
        }
        return {data: true};
    };
}

export const removeWebappPlugin = (manifest: PluginManifest): ActionFunc<boolean, GlobalState> => {
    return (dispatch) => {
        dispatch(hideRHSPlugin(manifest.id));
        dispatch({type: ActionTypes.REMOVED_WEBAPP_PLUGIN, data: manifest});
        return {data: true};
    };
};

// hideRHSPlugin closes the RHS if currently showing this plugin.
const hideRHSPlugin = (manifestId: string): ActionFunc<boolean, GlobalState> => {
    return (dispatch, getState) => {
        const state = getState();
        const rhsPlugins = state.plugins.components.RightHandSidebarComponent || [];
        const pluggableId = getPluggableId(state);
        const pluginComponent = rhsPlugins.find((element) => element.id === pluggableId && element.pluginId === manifestId);

        // Hide RHS if its showing this plugin
        if (pluginComponent) {
            dispatch(hideRHSPluginAction(pluggableId));
        }
        return {data: true};
    };
};
