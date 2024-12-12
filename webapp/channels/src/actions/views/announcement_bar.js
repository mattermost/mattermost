// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

import type {ActionFunc} from 'types/store';

export function incrementAnnouncementBarCount(): ActionFunc {
    return () => {
        return {
            type: ActionTypes.TRACK_ANNOUNCEMENT_BAR,
            data: true,
        };
    };
}

export function decrementAnnouncementBarCount(): ActionFunc {
    return () => {
        return {
            type: ActionTypes.DISMISS_ANNOUNCEMENT_BAR,
            data: true,
        };
    };
}
