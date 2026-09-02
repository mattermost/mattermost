// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

export function incrementAnnouncementBarCount() {
    return {
        type: ActionTypes.TRACK_ANNOUNCEMENT_BAR,
    };
}

export function decrementAnnouncementBarCount() {
    return {
        type: ActionTypes.DISMISS_ANNOUNCEMENT_BAR,
    };
}
