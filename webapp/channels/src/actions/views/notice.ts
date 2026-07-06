// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

export function dismissNotice(type: string) {
    return {
        type: ActionTypes.DISMISS_NOTICE,
        data: type,
    };
}
