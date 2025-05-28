// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

export function setAddChannelCtaDropdown(open: boolean) {
    return {
        type: ActionTypes.ADD_CHANNEL_CTA_DROPDOWN_TOGGLE,
        open,
    };
}
