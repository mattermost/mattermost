// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {getConnectionId} from 'selectors/general';

import type {GlobalState} from 'types/store';

export function createSchedulePost(schedulePost: ScheduledPost): ActionFuncAsync<{data?: ScheduledPost; error?: string}, GlobalState> {
    return async (dispatch, getState) => {
        const state = getState();
        const connectionId = getConnectionId(state);

        try {
            const createdPost = await Client4.createSchedulePost(schedulePost, connectionId);
            return {data: createdPost};

            // TODO: dispatch action to store created schedule
            // post in store to display it.
        } catch (error) {
            return {
                error,
            };
        }
    };
}
