// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {ChannelCategory} from '@mattermost/types/channel_categories';

import {setCategoryCollapsed, setCategorySorting} from 'mattermost-redux/actions/channel_categories';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentUser, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {isAdmin} from 'mattermost-redux/utils/user_utils';

import {getCategoryIdsHiddenByProductRail, getDraggingState, makeGetFilteredChannelIdsForCategory} from 'selectors/views/channel_sidebar';

import type {GlobalState} from 'types/store';

import SidebarCategory from './sidebar_category';

type OwnProps = {
    category: ChannelCategory;
};

function makeMapStateToProps() {
    const getChannelIdsForCategory = makeGetFilteredChannelIdsForCategory();

    return (state: GlobalState, ownProps: OwnProps) => {
        const channelIds = getChannelIdsForCategory(state, ownProps.category);

        // Hidden while the product rail's Channels or Boards section leaves it with nothing to show.
        const hiddenByProductRail = getCategoryIdsHiddenByProductRail(state).has(ownProps.category.id);

        return {
            channelIds,
            hiddenByProductRail,
            draggingState: getDraggingState(state),
            currentUserId: getCurrentUserId(state),
            isAdmin: isAdmin(getCurrentUser(state).roles),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            setCategoryCollapsed,
            setCategorySorting,
            savePreferences,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(SidebarCategory);
