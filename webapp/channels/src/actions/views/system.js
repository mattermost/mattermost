// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

import type {ActionFuncAsync} from 'types/store';

export function incrementWsErrorCount(): ActionFuncAsync {
    return async (dispatch) => {
        dispatch({
            type: ActionTypes.INCREMENT_WS_ERROR_COUNT,
        });
    };
}

export function resetWsErrorCount(): ActionFuncAsync {
    return async (dispatch) => {
        dispatch({
            type: ActionTypes.RESET_WS_ERROR_COUNT,
        });
    };
}
