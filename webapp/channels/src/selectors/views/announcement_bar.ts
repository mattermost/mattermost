// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

export function getAnnouncementBarCount(state: GlobalState) {
    return state.views.announcementBar.announcementBarState.announcementBarCount;
}
