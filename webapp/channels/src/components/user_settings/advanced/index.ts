// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {updateUserActive, revokeAllSessionsForUser} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {
    get,
    getUnreadScrollPositionPreference,
    makeGetCategory, makeGetUserCategory,
    syncedDraftsAreAllowed,
} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import AdvancedSettingsDisplay from './user_settings_advanced';
import type {OwnProps} from './user_settings_advanced';

const getAdvancedSettingsCategory = makeGetCategory('getAdvancedSettingsCategory', Preferences.CATEGORY_ADVANCED_SETTINGS);

function makeMapStateToProps() {
    const getUserAdvancedSettingsCategory = makeGetUserCategory('getAdvancedSettingsCategory', Preferences.CATEGORY_ADVANCED_SETTINGS);

    return (state: GlobalState, props: OwnProps) => {
        const config = getConfig(state);

        const enableUserDeactivation = config.EnableUserDeactivation === 'true';
        const enableJoinLeaveMessage = config.EnableJoinLeaveMessageByDefault === 'true';

        const userPreferences = props.adminMode && props.userPreferences ? props.userPreferences : undefined;
        const advancedSettingsCategory = userPreferences ? getUserAdvancedSettingsCategory(state, props.user.id) : getAdvancedSettingsCategory(state);

        return {
            advancedSettingsCategory,
            sendOnCtrlEnter: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter', 'false', userPreferences),
            codeBlockOnCtrlEnter: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'code_block_ctrl_enter', 'true', userPreferences),
            formatting: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'formatting', 'true', userPreferences),
            joinLeave: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'join_leave', enableJoinLeaveMessage.toString(), userPreferences),
            syncDrafts: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'sync_drafts', 'true', userPreferences),
            user: props.adminMode && props.user ? props.user : getCurrentUser(state),
            unreadScrollPosition: getUnreadScrollPositionPreference(state, userPreferences),
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

const connector = connect(makeMapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(AdvancedSettingsDisplay);
