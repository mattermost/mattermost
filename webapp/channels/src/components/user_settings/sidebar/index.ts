// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {setCategorySorting} from 'mattermost-redux/actions/channel_categories';
import {Preferences} from 'mattermost-redux/constants';
import {getInt, shouldShowUnreadsCategory} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCategoriesForCurrentTeam} from 'selectors/views/channel_sidebar';
import {GlobalState} from 'types/store';

import UserSettingsSidebar from './user_settings_sidebar';

function mapStateToProps(state: GlobalState) {
    return {
        showUnreadsCategory: shouldShowUnreadsCategory(state),
        currentUserId: getCurrentUserId(state),
        categories: getCategoriesForCurrentTeam(state),
        dmGmLimit: getInt(state, Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS, 20),
    };
}

const mapDispatchToProps = {
    savePreferences,
    setCategorySorting,
};

export default connect(mapStateToProps, mapDispatchToProps)(UserSettingsSidebar);
