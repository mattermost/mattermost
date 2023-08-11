// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';

import {setCategorySorting} from 'mattermost-redux/actions/channel_categories';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getVisibleDmGmLimit} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import SidebarCategorySortingMenu from './sidebar_category_sorting_menu';

function mapStateToProps(state: GlobalState) {
    return {
        selectedDmNumber: getVisibleDmGmLimit(state),
        currentUserId: getCurrentUserId(state),
    };
}

const mapDispatchToProps = {
    setCategorySorting,
    savePreferences,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(SidebarCategorySortingMenu);
