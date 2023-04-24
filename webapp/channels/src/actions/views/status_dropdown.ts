// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

export function setStatusDropdown(open: boolean) {
    return {
        type: ActionTypes.STATUS_DROPDOWN_TOGGLE,
        open,
    };
}
