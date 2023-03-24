// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

export function setNeedsLoggedInLimitReachedCheck(data: boolean) {
    return {
        type: ActionTypes.NEEDS_LOGGED_IN_LIMIT_REACHED_CHECK,
        data,
    };
}
