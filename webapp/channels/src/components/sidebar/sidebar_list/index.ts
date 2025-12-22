// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {PreferenceType} from '@mattermost/types/preferences';

import {moveCategory} from 'mattermost-redux/actions/channel_categories';
import {readAllMessages} from 'mattermost-redux/actions/channels';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {markAllInTeamAsRead} from 'mattermost-redux/actions/teams';
import {Preferences} from 'mattermost-redux/constants';
import {getCurrentChannelId, getUnreadChannelIds} from 'mattermost-redux/selectors/entities/channels';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {shouldShowUnreadsCategory, isCollapsedThreadsEnabled, get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getThreadCountsInCurrentTeam} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {switchToChannelById} from 'actions/views/channel';
import {
    moveChannelsInSidebar,
    setDraggingState,
    stopDragging,
    clearChannelSelection,
} from 'actions/views/channel_sidebar';
import {close, switchToLhsStaticPage} from 'actions/views/lhs';
import {openModal} from 'actions/views/modals';
import {getCurrentStaticPageId, getVisibleStaticPages} from 'selectors/lhs';
import {
    getDisplayedChannels,
    getDraggingState,
    getCategoriesForCurrentTeam,
    isUnreadFilterEnabled,
} from 'selectors/views/channel_sidebar';

import type {GlobalState} from 'types/store';

import SidebarList from './sidebar_list';

function mapStateToProps(state: GlobalState) {
    const currentTeam = getCurrentTeam(state);
    const collapsedThreads = isCollapsedThreadsEnabled(state);
    const getmarkAllAsReadWithoutConfirm = (state: GlobalState) =>
        getPreference(state, Preferences.CATEGORY_SHORTCUT_ACTIONS, Preferences.MARK_ALL_READ_WITHOUT_CONFIRM, 'false');

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
        markAllAsReadWithoutConfirm: getmarkAllAsReadWithoutConfirm(state) === 'true',
        markAllAsReadShortcutEnabled: getFeatureFlagValue(state, 'EnableShiftEscapeToMarkAllRead') === 'true',
        currentStaticPageId: getCurrentStaticPageId(state),
        staticPages: getVisibleStaticPages(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    const setMarkAllAsReadWithoutConfirm = (userId: string, value: boolean) => {
        const preference: PreferenceType = {
            category: Preferences.CATEGORY_SHORTCUT_ACTIONS,
            name: Preferences.MARK_ALL_READ_WITHOUT_CONFIRM,
            user_id: userId,
            value: String(value),
        };
        return savePreferences(userId, [preference]);
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
            readAllMessages,
            markAllInTeamAsRead,
            setMarkAllAsReadWithoutConfirm,
            openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SidebarList);
