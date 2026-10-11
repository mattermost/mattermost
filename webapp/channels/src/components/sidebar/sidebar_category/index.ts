// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {ChannelCategory} from '@mattermost/types/channel_categories';

import {setCategoryCollapsed, setCategorySorting} from 'mattermost-redux/actions/channel_categories';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {canStartDmGm, isDmGmReadDenied} from 'mattermost-redux/selectors/entities/render_permissions';
import {getCurrentUser, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {isAdmin} from 'mattermost-redux/utils/user_utils';

import {getDraggingState, makeGetFilteredChannelIdsForCategory} from 'selectors/views/channel_sidebar';

import type {GlobalState} from 'types/store';

import SidebarCategory from './sidebar_category';

type OwnProps = {
    category: ChannelCategory;
};

function makeMapStateToProps() {
    const getChannelIdsForCategory = makeGetFilteredChannelIdsForCategory();

    return (state: GlobalState, ownProps: OwnProps) => {
        return {
            channelIds: getChannelIdsForCategory(state, ownProps.category),
            draggingState: getDraggingState(state),
            currentUserId: getCurrentUserId(state),
            isAdmin: isAdmin(getCurrentUser(state).roles),
            hideCategory: ownProps.category.type === CategoryTypes.DIRECT_MESSAGES && isDmGmReadDenied(state),
            canStartDmGm: canStartDmGm(state),
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
