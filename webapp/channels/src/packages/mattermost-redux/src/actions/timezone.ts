// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getCurrentTimezoneFull} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {updateMe} from './users';

export function autoUpdateTimezone(deviceTimezone: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const currentUser = getCurrentUser(getState());
        const currentTimezone = getCurrentTimezoneFull(getState());
        const newTimezoneExists = currentTimezone.automaticTimezone !== deviceTimezone;

        if (currentTimezone.useAutomaticTimezone && newTimezoneExists) {
            const timezone = {
                useAutomaticTimezone: 'true',
                automaticTimezone: deviceTimezone,
                manualTimezone: currentTimezone.manualTimezone,
            };

            const updatedUser = {
                ...currentUser,
                timezone,
            };

            dispatch(updateMe(updatedUser));
        }

        return {data: true};
    };
}
