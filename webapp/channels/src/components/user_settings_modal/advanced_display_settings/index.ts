// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import type {Dispatch} from 'redux';
import {bindActionCreators} from 'redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {updateUserActive, revokeAllSessionsForUser} from 'mattermost-redux/actions/users';
import {Preferences as ReduxPreferences} from 'mattermost-redux/constants';
import {getConfig, isPerformanceDebuggingEnabled} from 'mattermost-redux/selectors/entities/general';
import {
    get,
    getUnreadScrollPositionPreference,
    makeGetCategory,
    makeGetUserCategory,
    getUserPreferences,
    syncedDraftsAreAllowed,
} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import AdvancedDisplaySettings from './advanced_display_settings';
import type {OwnProps} from './advanced_display_settings';

function makeMapStateToProps(state: GlobalState, props: OwnProps) {
    const getAdvancedSettingsCategory = props.userId ? makeGetUserCategory(props.userId) : makeGetCategory();

    return (state: GlobalState, props: OwnProps) => {
        const config = getConfig(state);

        const enableUserDeactivation = config.EnableUserDeactivation === 'true';
        const userPreferences = props.userId ? getUserPreferences(state, props.userId) : undefined;

        return {
            advancedSettingsCategory: getAdvancedSettingsCategory(state, Preferences.CATEGORY_ADVANCED_SETTINGS),
            sendOnCtrlEnter: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter', 'false', userPreferences),
            codeBlockOnCtrlEnter: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'code_block_ctrl_enter', 'true', userPreferences),
            formatting: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'formatting', 'true', userPreferences),
            joinLeave: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'join_leave', 'true', userPreferences),
            disableClientPlugins: get(state, ReduxPreferences.CATEGORY_PERFORMANCE_DEBUGGING, ReduxPreferences.NAME_DISABLE_CLIENT_PLUGINS, 'false', userPreferences),
            disableTelemetry: get(state, ReduxPreferences.CATEGORY_PERFORMANCE_DEBUGGING, ReduxPreferences.NAME_DISABLE_TELEMETRY, 'false', userPreferences),
            disableTypingMessages: get(state, ReduxPreferences.CATEGORY_PERFORMANCE_DEBUGGING, ReduxPreferences.NAME_DISABLE_TYPING_MESSAGES, 'false', userPreferences),
            syncedDraftsAreAllowed: syncedDraftsAreAllowed(state),
            performanceDebuggingEnabled: isPerformanceDebuggingEnabled(state),
            userId: props.userId || getCurrentUser(state).id,
            unreadScrollPosition: getUnreadScrollPositionPreference(state),
            enableUserDeactivation,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            savePreferences,
            updateUserActive,
            revokeAllSessionsForUser,
        }, dispatch),
    };
}

const connector = connect(makeMapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(AdvancedDisplaySettings);
