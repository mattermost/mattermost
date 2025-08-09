// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ContentFlaggingConfig} from '@mattermost/types/content_flagging';

import {TeamTypes, ContentFlaggingTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

export function getTeamContentFlaggingStatus(teamId: string): ActionFuncAsync<{enabled: boolean}> {
    return async (dispatch, getState) => {
        let response;

        try {
            response = await Client4.getTeamContentFlaggingStatus(teamId);

            dispatch({
                type: TeamTypes.RECEIVED_CONTENT_FLAGGING_STATUS,
                data: {
                    teamId,
                    status: response.enabled,
                },
            });
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {data: response};
    };
}

export function getContentFlaggingConfig(): ActionFuncAsync<ContentFlaggingConfig> {
    return async (dispatch, getState) => {
        let response;

        try {
            response = await Client4.getContentFlaggingConfig();

            dispatch({
                type: ContentFlaggingTypes.RECEIVED_CONTENT_FLAGGING_CONFIG,
                data: response,
            });
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {data: response};
    };
}
