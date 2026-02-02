// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';

import {getCurrentChannelId, makeGetChannel, makeGetChannelUnreadCount} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getFollowedThreadsInChannel} from 'mattermost-redux/selectors/entities/threads';

import {getAutoSortedCategoryIds, getDraggingState, isChannelSelected} from 'selectors/views/channel_sidebar';

import type {GlobalState} from 'types/store';

import SidebarChannel from './sidebar_channel';

type OwnProps = {
    channelId: string;
    channelIndex: number;
    isCategoryCollapsed: boolean;
    isCategoryDragged: boolean;
    isDraggable: boolean;
    isAutoSortedCategory: boolean;

    /**
     * Sets the ref for the sidebar channel div element, so that it can be used by parent components
     */
    setChannelRef: (channelId: string, ref: HTMLLIElement) => void;
}

function makeMapStateToProps() {
    const getChannel = makeGetChannel();
    const getUnreadCount = makeGetChannelUnreadCount();

    return (state: GlobalState, ownProps: OwnProps) => {
        const channel = getChannel(state, ownProps.channelId);
        const currentTeam = getCurrentTeam(state);

        const currentChannelId = getCurrentChannelId(state);

        const unreadCount = getUnreadCount(state, channel?.id || '');

        // Only fetch followed threads if ThreadsInSidebar feature flag is enabled AND Collapsed Reply Threads is enabled
        // (The /thread/:id route only exists when CRT is enabled)
        const config = getConfig(state);
        const isThreadsInSidebarEnabled = (config as Record<string, string>)?.FeatureFlagThreadsInSidebar === 'true';
        const isCRTEnabled = isCollapsedThreadsEnabled(state);
        const followedThreads = (isThreadsInSidebarEnabled && isCRTEnabled && channel) ? getFollowedThreadsInChannel(state, channel.id) : [];

        return {
            channel,
            isCurrentChannel: channel?.id === currentChannelId,
            currentTeamName: currentTeam?.name,
            unreadMentions: unreadCount.mentions,
            isUnread: unreadCount.showUnread,
            draggingState: getDraggingState(state),
            isChannelSelected: isChannelSelected(state, ownProps.channelId),
            multiSelectedChannelIds: state.views.channelSidebar.multiSelectedChannelIds,
            autoSortedCategoryIds: getAutoSortedCategoryIds(state),
            followedThreads,
        };
    };
}

const connector = connect(makeMapStateToProps);

type PropsFromRedux = Omit<ConnectedProps<typeof connector>, 'dispatch'>;

export type Props = OwnProps & PropsFromRedux;

export default connector(SidebarChannel);
