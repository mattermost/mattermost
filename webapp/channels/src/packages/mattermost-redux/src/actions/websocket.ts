// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import {UserTypes} from 'mattermost-redux/action_types';
import {getCurrentUserId, getUsers} from 'mattermost-redux/selectors/entities/users';
import {ActionFunc, DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

import {getKnownUsers} from './users';

export function removeNotVisibleUsers(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        let knownUsers: Set<string>;
        try {
            const fetchResult = await dispatch(getKnownUsers());
            knownUsers = new Set((fetchResult as any).data);
        } catch (err) {
            return {error: err};
        }
        knownUsers.add(getCurrentUserId(state));

        const allUsers = Object.keys(getUsers(state));
        const usersToRemove = new Set(allUsers.filter((x) => !knownUsers.has(x)));

        const actions = [];
        for (const userToRemove of usersToRemove.values()) {
            actions.push({type: UserTypes.PROFILE_NO_LONGER_VISIBLE, data: {user_id: userToRemove}});
        }
        if (actions.length > 0) {
            dispatch(batchActions(actions));
        }

        return {data: true};
    };
}
