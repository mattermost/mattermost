// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

export const getLastPostsApiTimeForChannel = (state: GlobalState, channelId: string) => state.views.channel.lastGetPosts[channelId];
export const getToastStatus = (state: GlobalState) => state.views.channel.toastStatus;
