// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {updateUserActive, revokeAllSessionsForUser} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {
    get,
    getFromPreferences, getUnreadScrollPositionFromPreference,
    getUnreadScrollPositionPreference,
    makeGetCategory, makeGetUserCategory,
    syncedDraftsAreAllowed,
} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import type {OwnProps} from './user_settings_advanced';
import AdvancedSettingsDisplay from './user_settings_advanced';

function makeMapStateToProps(state: GlobalState, props: OwnProps) {
    const getAdvancedSettingsCategory = props.adminMode ? makeGetUserCategory(props.currentUser.id) : makeGetCategory();

    return (state: GlobalState, props: OwnProps) => {
        const config = getConfig(state);

        const enablePreviewFeatures = config.EnablePreviewFeatures === 'true';
        const enableUserDeactivation = config.EnableUserDeactivation === 'true';
        const enableJoinLeaveMessage = config.EnableJoinLeaveMessageByDefault === 'true';

        let getPreference = (prefCategory: string, prefName: string, defaultValue: string) => get(state, prefCategory, prefName, defaultValue);
        if (props.adminMode && props.userPreferences) {
            // This ties the function to the current value of userPreferences for the current execution of this function
            const preferences = props.userPreferences;
            getPreference = (prefCategory, prefName, defaultValue) => getFromPreferences(preferences, prefCategory, prefName, defaultValue);
        }

        return {
            advancedSettingsCategory: getAdvancedSettingsCategory(state, Preferences.CATEGORY_ADVANCED_SETTINGS),
            sendOnCtrlEnter: getPreference(Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter', 'false'),
            codeBlockOnCtrlEnter: getPreference(Preferences.CATEGORY_ADVANCED_SETTINGS, 'code_block_ctrl_enter', 'true'),
            formatting: getPreference(Preferences.CATEGORY_ADVANCED_SETTINGS, 'formatting', 'true'),
            joinLeave: getPreference(Preferences.CATEGORY_ADVANCED_SETTINGS, 'join_leave', enableJoinLeaveMessage.toString()),
            syncDrafts: getPreference(Preferences.CATEGORY_ADVANCED_SETTINGS, 'sync_drafts', 'true'),
            currentUser: props.adminMode && props.currentUser ? props.currentUser : getCurrentUser(state),
            unreadScrollPosition: props.adminMode && props.userPreferences ? getUnreadScrollPositionFromPreference(props.userPreferences) : getUnreadScrollPositionPreference(state),
            enablePreviewFeatures,
            enableUserDeactivation,
            syncedDraftsAreAllowed: syncedDraftsAreAllowed(state),
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

export default connect(makeMapStateToProps, mapDispatchToProps)(AdvancedSettingsDisplay);
