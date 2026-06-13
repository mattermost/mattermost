// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {savePreferences, deletePreferences, saveTheme, deleteTeamSpecificThemes} from 'mattermost-redux/actions/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getMyPreferences, getTheme, getThemePreferences} from 'mattermost-redux/selectors/entities/preferences';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';
import {Preferences} from 'mattermost-redux/constants';
import {getCurrentTeamId, getMyTeamsCount} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import UserSettingsTheme from './user_settings_theme';

function mapStateToProps(state: GlobalState) {
    const syncKey = getPreferenceKey(
        Preferences.CATEGORY_DISPLAY_SETTINGS,
        Preferences.NAME_THEME_SYNC_WITH_OS,
    );

    return {
        currentTeamId: getCurrentTeamId(state),
        currentUserId: getCurrentUserId(state),
        theme: getTheme(state),
        applyToAllTeams: getThemePreferences(state).length <= 1,
        showAllTeamsCheckbox: getMyTeamsCount(state) > 1,
        syncWithOS: getMyPreferences(state)[syncKey]?.value === 'true',
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            saveTheme,
            deleteTeamSpecificThemes,
            openModal,
            savePreferences,
            deletePreferences,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserSettingsTheme);
