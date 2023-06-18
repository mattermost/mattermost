// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {setCategoryCollapsed, setCategorySorting} from 'mattermost-redux/actions/channel_categories';
import {GenericAction} from 'mattermost-redux/types/actions';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {ChannelCategory} from '@mattermost/types/channel_categories';
import {getCurrentUser, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {isAdmin} from 'mattermost-redux/utils/user_utils';

import {getDraggingState, makeGetFilteredChannelIdsForCategory} from 'selectors/views/channel_sidebar';
import {GlobalState} from 'types/store';

import SidebarCategory from './sidebar_category';

type OwnProps = {
    category: ChannelCategory;
}

function makeMapStateToProps() {
    const getChannelIdsForCategory = makeGetFilteredChannelIdsForCategory();

    return (state: GlobalState, ownProps: OwnProps) => {
        return {
            channelIds: getChannelIdsForCategory(state, ownProps.category),
            draggingState: getDraggingState(state),
            currentUserId: getCurrentUserId(state),
            isAdmin: isAdmin(getCurrentUser(state).roles),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            setCategoryCollapsed,
            setCategorySorting,
            savePreferences,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(SidebarCategory);
