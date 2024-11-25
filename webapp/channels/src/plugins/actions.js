// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {hideRHSPlugin as hideRHSPluginAction} from 'actions/views/rhs';
import {getPluggableId} from 'selectors/rhs';
import {ActionTypes} from 'utils/constants';

import type {PluginManifest} from '@mattermost/types/plugins';
import type {GlobalState} from '@mattermost/types/store';
import type {ActionFuncAsync} from '@mattermost/types/actions';

export const removeWebappPlugin = (manifest: PluginManifest): ActionFuncAsync => {
    return async (dispatch) => {
        dispatch(hideRHSPlugin(manifest.id));
        dispatch({type: ActionTypes.REMOVED_WEBAPP_PLUGIN, data: manifest});
    };
};

// hideRHSPlugin closes the RHS if currently showing this plugin.
const hideRHSPlugin = (manifestId: string): ActionFuncAsync<void, GlobalState> => {
    return async (dispatch, getState) => {
        const state = getState();
        const rhsPlugins = state.plugins.components.RightHandSidebarComponent || [];
        const pluggableId = getPluggableId(state);
        const pluginComponent = rhsPlugins.find((element) => element.id === pluggableId && element.pluginId === manifestId);

        // Hide RHS if its showing this plugin
        if (pluginComponent) {
            dispatch(hideRHSPluginAction(pluggableId));
        }
    };
};
