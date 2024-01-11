// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppBinding} from '@mattermost/types/apps';

import {AppsTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getChannel, getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import type {NewActionFuncAsync} from 'mattermost-redux/types/actions';

import {bindClientFunc} from './helpers';

export function fetchAppBindings(channelID: string): NewActionFuncAsync<AppBinding[] | false> {
    return async (dispatch, getState) => {
        if (!channelID) {
            return {data: false};
        }

        const state = getState();
        const channel = getChannel(state, channelID);
        const teamID = channel?.team_id || getCurrentTeamId(state);

        return dispatch(bindClientFunc({
            clientFunc: () => Client4.getAppsBindings(channelID, teamID),
            onSuccess: AppsTypes.RECEIVED_APP_BINDINGS,
            onFailure: AppsTypes.FAILED_TO_FETCH_APP_BINDINGS,
        }) as any); // HARRISONTODO Type bindClientFunc
    };
}

export function fetchRHSAppsBindings(channelID: string): NewActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();

        const currentChannelID = getCurrentChannelId(state);
        const channel = getChannel(state, channelID);
        const teamID = channel?.team_id || getCurrentTeamId(state);

        if (channelID === currentChannelID) {
            const bindings = JSON.parse(JSON.stringify(state.entities.apps.main.bindings));
            dispatch({
                data: bindings,
                type: AppsTypes.RECEIVED_APP_RHS_BINDINGS,
            });
            return {data: true};
        }

        dispatch(bindClientFunc({
            clientFunc: () => Client4.getAppsBindings(channelID, teamID),
            onSuccess: AppsTypes.RECEIVED_APP_RHS_BINDINGS,
            onFailure: AppsTypes.FAILED_TO_FETCH_APP_BINDINGS,
        }));
        return {data: true};
    };
}
