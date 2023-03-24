// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionFunc, DispatchFunc} from 'mattermost-redux/types/actions';
import {DebugBarTypes} from 'mattermost-redux/action_types';

export function addLine(data: any): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        return dispatch({
            data,
            type: DebugBarTypes.ADD_LINE,
        });
    };
}

export function clearLines(key?: string): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        return dispatch({
            type: DebugBarTypes.CLEAR_LINES,
            key,
        });
    };
}
