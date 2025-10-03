// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {moveCategory} from 'mattermost-redux/actions/channel_categories';
import {readMultipleChannels} from 'mattermost-redux/actions/channels';
import {getCurrentChannelId, getUnreadChannelIds} from 'mattermost-redux/selectors/entities/channels';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {shouldShowUnreadsCategory, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getThreadCountsInCurrentTeam} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {setGlobalItem} from 'actions/storage';
import {switchToChannelById} from 'actions/views/channel';
import {
    moveChannelsInSidebar,
    setDraggingState,
    stopDragging,
    clearChannelSelection,
} from 'actions/views/channel_sidebar';
import {close, switchToLhsStaticPage} from 'actions/views/lhs';
import {getCurrentStaticPageId, getVisibleStaticPages} from 'selectors/lhs';
import {makeGetGlobalItem} from 'selectors/storage';
import {
    getDisplayedChannels,
    getDraggingState,
    getCategoriesForCurrentTeam,
    isUnreadFilterEnabled,
} from 'selectors/views/channel_sidebar';
import {createStoredKey} from 'stores/hooks';

import {StoragePrefixes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import SidebarList from './sidebar_list';

function mapStateToProps(state: GlobalState) {
    const currentTeam = getCurrentTeam(state);
    const collapsedThreads = isCollapsedThreadsEnabled(state);
    const currentUserId = getCurrentUserId(state);
    const getmarkAllAsReadWithoutConfirm = makeGetGlobalItem(
        createStoredKey(StoragePrefixes.MARK_ALL_READ_WITHOUT_CONFIRM, currentUserId), false);

    let hasUnreadThreads = false;
    if (collapsedThreads) {
        hasUnreadThreads = Boolean(getThreadCountsInCurrentTeam(state)?.total_unread_threads);
    }

    return {
        currentTeam,
        currentUserId: getCurrentUserId(state),
        currentChannelId: getCurrentChannelId(state),
        categories: getCategoriesForCurrentTeam(state),
        isUnreadFilterEnabled: isUnreadFilterEnabled(state),
        unreadChannelIds: getUnreadChannelIds(state),
        displayedChannels: getDisplayedChannels(state),
        draggingState: getDraggingState(state),
        newCategoryIds: state.views.channelSidebar.newCategoryIds,
        multiSelectedChannelIds: state.views.channelSidebar.multiSelectedChannelIds,
        showUnreadsCategory: shouldShowUnreadsCategory(state),
        collapsedThreads,
        hasUnreadThreads,
        markAllAsReadWithoutConfirm: getmarkAllAsReadWithoutConfirm(state),
        markAllAsReadShortcutEnabled: getFeatureFlagValue(state, 'EnableShiftEscapeToMarkAllRead') === 'true',
        currentStaticPageId: getCurrentStaticPageId(state),
        staticPages: getVisibleStaticPages(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    const setMarkAllAsReadWithoutConfirm = (userId: string, value: boolean) => {
        return setGlobalItem(createStoredKey(StoragePrefixes.MARK_ALL_READ_WITHOUT_CONFIRM, userId), value);
    };

    return {
        actions: bindActionCreators({
            close,
            switchToChannelById,
            moveChannelsInSidebar,
            moveCategory,
            setDraggingState,
            stopDragging,
            clearChannelSelection,
            switchToLhsStaticPage,
            readMultipleChannels,
            setMarkAllAsReadWithoutConfirm,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SidebarList);
