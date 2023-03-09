// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {getTheme, makeGetCategory} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId, getMyTeamsCount} from 'mattermost-redux/selectors/entities/teams';

import {saveTheme, deleteTeamSpecificThemes} from 'mattermost-redux/actions/preferences';
import {openModal} from 'actions/views/modals';

import {Preferences} from 'utils/constants';

import {GlobalState} from 'types/store';

import UserSettingsTheme from './user_settings_theme';

function makeMapStateToProps() {
    const getThemeCategory = makeGetCategory();

    return (state: GlobalState) => {
        return {
            currentTeamId: getCurrentTeamId(state),
            theme: getTheme(state),
            applyToAllTeams: getThemeCategory(state, Preferences.CATEGORY_THEME).length <= 1,
            showAllTeamsCheckbox: getMyTeamsCount(state) > 1,
        };
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

export default connect(makeMapStateToProps, mapDispatchToProps)(UserSettingsTheme);
