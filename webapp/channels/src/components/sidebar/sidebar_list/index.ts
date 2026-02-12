// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {ChannelCategory} from '@mattermost/types/channel_categories';
import {CategorySorting} from '@mattermost/types/channel_categories';

import {moveCategory} from 'mattermost-redux/actions/channel_categories';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {getCurrentChannelId, getUnreadChannelIds, getMyChannelMemberships, getAllChannels} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {shouldShowUnreadsCategory, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getThreadCountsInCurrentTeam} from 'mattermost-redux/selectors/entities/threads';

import {switchToChannelById} from 'actions/views/channel';
import {
    moveChannelsInSidebar,
    setDraggingState,
    stopDragging,
    clearChannelSelection,
} from 'actions/views/channel_sidebar';
import {close, switchToLhsStaticPage} from 'actions/views/lhs';
import {getCurrentStaticPageId, getVisibleStaticPages} from 'selectors/lhs';
import {
    getDisplayedChannels,
    getDraggingState,
    getCategoriesForCurrentTeam,
    isUnreadFilterEnabled,
} from 'selectors/views/channel_sidebar';
import {moveChannelInCanonicalLayout, moveCategoryInCanonicalLayout, addCategoryToCanonicalLayout, importPersonalLayoutToCanonical} from 'actions/views/channel_sync';
import {getShouldSync, isLayoutEditMode, getSyncLayout, getEditorChannels, getSyncedCategories} from 'selectors/views/channel_sync';
import {isGuildedLayoutEnabled} from 'selectors/views/guilded_layout';

import type {GlobalState} from 'types/store';

import SidebarList from './sidebar_list';

function mapStateToProps(state: GlobalState) {
    const currentTeam = getCurrentTeam(state);
    const collapsedThreads = isCollapsedThreadsEnabled(state);

    let hasUnreadThreads = false;
    if (collapsedThreads) {
        hasUnreadThreads = Boolean(getThreadCountsInCurrentTeam(state)?.total_unread_threads);
    }

    const isSynced = getShouldSync(state);
    const personalCategories = getCategoriesForCurrentTeam(state);
    const config = getConfig(state);
    const isChannelSyncEnabled = config.FeatureFlagChannelSync === 'true';

    let categories;
    if (isSynced) {
        const syncedCats = getSyncedCategories(state);
        if (syncedCats) {
            // Add the personal DM category so Guilded layout can filter it and non-Guilded users see DMs
            const dmCat = personalCategories.find((c) => c.type === CategoryTypes.DIRECT_MESSAGES);
            categories = dmCat ? [...syncedCats, dmCat] : syncedCats;
        } else {
            categories = personalCategories;
        }
    } else if (isChannelSyncEnabled) {
        // ChannelSync enabled but no layout defined yet — show all team channels alphabetically in Uncategorized
        const teamId = getCurrentTeamId(state);
        const userId = getCurrentUserId(state);
        const memberships = getMyChannelMemberships(state);
        const allChannels = getAllChannels(state);
        const teamChannelIds = Object.keys(memberships)
            .filter((chId) => {
                const ch = allChannels[chId];
                return ch && ch.team_id === teamId && ch.type !== 'D' && ch.type !== 'G';
            })
            .sort((a, b) => {
                const chA = allChannels[a];
                const chB = allChannels[b];
                return (chA?.display_name || '').localeCompare(chB?.display_name || '');
            });

        const channelsCat: ChannelCategory = {
            id: 'sync-all-channels',
            user_id: userId,
            team_id: teamId,
            type: CategoryTypes.CUSTOM,
            display_name: 'Uncategorized',
            sorting: CategorySorting.Manual,
            channel_ids: teamChannelIds,
            muted: false,
            collapsed: false,
        };
        const dmCat = personalCategories.find((c) => c.type === CategoryTypes.DIRECT_MESSAGES);
        categories = dmCat ? [channelsCat, dmCat] : [channelsCat];
    } else {
        categories = personalCategories;
    }

    return {
        currentTeam,
        currentChannelId: getCurrentChannelId(state),
        categories,
        isUnreadFilterEnabled: isUnreadFilterEnabled(state),
        unreadChannelIds: getUnreadChannelIds(state),
        displayedChannels: getDisplayedChannels(state),
        draggingState: getDraggingState(state),
        newCategoryIds: state.views.channelSidebar.newCategoryIds,
        multiSelectedChannelIds: state.views.channelSidebar.multiSelectedChannelIds,
        showUnreadsCategory: shouldShowUnreadsCategory(state),
        collapsedThreads,
        hasUnreadThreads,
        currentStaticPageId: getCurrentStaticPageId(state),
        staticPages: getVisibleStaticPages(state),
        isGuildedLayoutEnabled: isGuildedLayoutEnabled(state),
        isSynced,
        isEditMode: isLayoutEditMode(state),
        editLayout: getSyncLayout(state),
        editorChannels: getEditorChannels(state),
        userChannelIds: new Set(Object.keys(getMyChannelMemberships(state))),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
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
            moveChannelInCanonicalLayout,
            moveCategoryInCanonicalLayout,
            addCategoryToCanonicalLayout,
            importPersonalLayoutToCanonical,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SidebarList);
