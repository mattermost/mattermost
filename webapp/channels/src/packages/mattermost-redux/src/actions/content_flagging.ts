// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TeamTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

export function getTeamContentFlaggingStatus(teamId: string): ActionFuncAsync<boolean> {
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

        return response;
    };
}
