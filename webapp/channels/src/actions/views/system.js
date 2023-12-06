// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

export function incrementWsErrorCount() {
    return async (dispatch) => {
        dispatch({
            type: ActionTypes.INCREMENT_WS_ERROR_COUNT,
        });
    };
}

export function resetWsErrorCount() {
    return async (dispatch) => {
        dispatch({
            type: ActionTypes.RESET_WS_ERROR_COUNT,
        });
    };
}
