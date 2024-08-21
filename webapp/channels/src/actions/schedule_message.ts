// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {Client4} from 'mattermost-redux/client';
import type {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

import {getConnectionId} from 'selectors/general';

import type {GlobalState} from 'types/store';

export function createSchedulePost(schedulePost: ScheduledPost) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
        const connectionId = getConnectionId(state);

        try {
            await Client4.createSchedulePost(schedulePost, connectionId);

            // TODO: dispatch action to store created schedule
            // post in store to display it.
        } catch (error) {
            return {
                created: false,
                error,
            };
        }

        return {created: true};
    };
}
