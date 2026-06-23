// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

export function incrementWsErrorCount() {
    return {
        type: ActionTypes.INCREMENT_WS_ERROR_COUNT,
    };
}

export function resetWsErrorCount() {
    return {
        type: ActionTypes.RESET_WS_ERROR_COUNT,
    };
}
