// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {SchedulePost} from '@mattermost/types/lib/schedule_post';

import {Client4} from 'mattermost-redux/client';
import type {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

import {getConnectionId} from 'selectors/general';

import type {GlobalState} from 'types/store';

export function createSchedulePost(schedulePost: SchedulePost) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
        const connectionId = getConnectionId(state);

        try {
            const createdSchedulePost = await Client4.createSchedulePost(schedulePost, connectionId);

            console.log(createdSchedulePost);

            // TODO: dispatch action to store created schedule
            // post in store to display it.
        } catch (error) {
            return {
                data: false,
                error,
            };
        }

        return {data: true};
    };
}
