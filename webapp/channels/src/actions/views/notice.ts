// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

import type {ActionFunc} from 'types/store';

export function dismissNotice(type: string): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: ActionTypes.DISMISS_NOTICE,
            data: type,
        });

        return {data: true};
    };
}
