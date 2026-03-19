// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelTabsState} from '@mattermost/types/channel_tabs';
import type {GlobalState} from '@mattermost/types/store';

const EMPTY_TABS = {};

export const getChannelTabs = (state: GlobalState, channelId: string): ChannelTabsState['byChannelId'][string] => {
    const tabs = state.entities.channelTabs.byChannelId[channelId];

    if (!tabs) {
        return EMPTY_TABS;
    }

    return tabs;
};

export const getChannelTab = (state: GlobalState, channelId: string, tabId: string) => {
    return getChannelTabs(state, channelId)[tabId];
};
