// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch, AnyAction} from 'redux';

import {deleteTeamSpecificThemes, savePreferences, saveTheme} from 'mattermost-redux/actions/preferences';
import {getTheme, getThemePreferences} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId, getMyTeamsCount} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import UserSettingsTheme from './user_settings_theme';

function mapStateToProps(state: GlobalState) {
    const teamId = getCurrentTeamId(state);

    // Get the dark theme if it exists
    const darkThemePreferences = state.entities.preferences.myPreferences;
    let darkTheme;

    // Find the dark theme for the current team or the default dark theme
    const darkThemePrefKey = `theme_dark--${teamId}`;
    const defaultDarkThemePrefKey = 'theme_dark--';

    if (darkThemePreferences[darkThemePrefKey]) {
        try {
            darkTheme = JSON.parse(darkThemePreferences[darkThemePrefKey].value);
        } catch {
            // Leave darkTheme undefined if parsing fails
        }
    } else if (darkThemePreferences[defaultDarkThemePrefKey]) {
        try {
            darkTheme = JSON.parse(darkThemePreferences[defaultDarkThemePrefKey].value);
        } catch {
            // Leave darkTheme undefined if parsing fails
        }
    }

    // Check if theme auto switch is enabled
    const themeAutoSwitchPref = darkThemePreferences[`${Preferences.CATEGORY_DISPLAY_SETTINGS}--theme_auto_switch`];
    const themeAutoSwitch = themeAutoSwitchPref ? themeAutoSwitchPref.value === 'true' : false;

    return {
        currentTeamId: teamId,
        theme: getTheme(state),
        darkTheme,
        themeAutoSwitch,
        applyToAllTeams: getThemePreferences(state).length <= 1,
        showAllTeamsCheckbox: getMyTeamsCount(state) > 1,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            saveTheme,
            saveDarkTheme: (teamId: string, theme: any) => {
                const key = teamId || '';
                return (dispatch: Dispatch, getState: () => GlobalState) => {
                    const state = getState();
                    const currentUserId = getCurrentUserId(state);
                    return dispatch(savePreferences(currentUserId, [{
                        user_id: currentUserId,
                        category: 'theme_dark',
                        name: key,
                        value: JSON.stringify(theme),
                    }]) as unknown as AnyAction);
                };
            },
            saveThemeAutoSwitch: (value: boolean) => {
                return (dispatch: Dispatch, getState: () => GlobalState) => {
                    const state = getState();
                    const currentUserId = getCurrentUserId(state);
                    return dispatch(savePreferences(currentUserId, [{
                        user_id: currentUserId,
                        category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                        name: 'theme_auto_switch',
                        value: value.toString(),
                    }]) as unknown as AnyAction);
                };
            },
            deleteTeamSpecificThemes,
            openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserSettingsTheme);
