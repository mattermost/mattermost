// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {saveTheme, deleteTeamSpecificThemes} from 'mattermost-redux/actions/preferences';
import {getTheme, getThemePreferences} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId, getMyTeamsCount} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import UserSettingsTheme from './user_settings_theme';

function mapStateToProps(state: GlobalState) {
    return {
        currentTeamId: getCurrentTeamId(state),
        theme: getTheme(state),
        applyToAllTeams: getThemePreferences(state).length <= 1,
        showAllTeamsCheckbox: getMyTeamsCount(state) > 1,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            saveTheme,
            deleteTeamSpecificThemes,
            openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserSettingsTheme);
