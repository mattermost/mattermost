// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {updateUserActive, revokeAllSessionsForUser} from 'mattermost-redux/actions/users';
import {getConfig, isPerformanceDebuggingEnabled} from 'mattermost-redux/selectors/entities/general';
import {get, getUnreadScrollPositionPreference, makeGetCategory, syncedDraftsAreAllowed} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import AdvancedSettingsDisplay from './user_settings_advanced';
import type {Props} from './user_settings_advanced';

function makeMapStateToProps() {
    const getAdvancedSettingsCategory = makeGetCategory();

    return (state: GlobalState) => {
        const config = getConfig(state);

        const enablePreviewFeatures = config.EnablePreviewFeatures === 'true';
        const enableUserDeactivation = config.EnableUserDeactivation === 'true';
        const disableWebappPrefetchAllowed = isPerformanceDebuggingEnabled(state);
        const enableJoinLeaveMessage = config.EnableJoinLeaveMessageByDefault === 'true';

        return {
            advancedSettingsCategory: getAdvancedSettingsCategory(state, Preferences.CATEGORY_ADVANCED_SETTINGS),
            sendOnCtrlEnter: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter', 'false'),
            codeBlockOnCtrlEnter: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'code_block_ctrl_enter', 'true'),
            formatting: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'formatting', 'true'),
            joinLeave: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'join_leave', enableJoinLeaveMessage.toString()),
            syncDrafts: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'sync_drafts', 'true'),
            currentUser: getCurrentUser(state),
            unreadScrollPosition: getUnreadScrollPositionPreference(state),
            enablePreviewFeatures,
            enableUserDeactivation,
            syncedDraftsAreAllowed: syncedDraftsAreAllowed(state),
            disableWebappPrefetchAllowed,
            dataPrefetchEnabled: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'data_prefetch', 'true'),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            savePreferences,
            updateUserActive,
            revokeAllSessionsForUser,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(AdvancedSettingsDisplay);
