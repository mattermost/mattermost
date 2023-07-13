// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {get, getUnreadScrollPositionPreference, makeGetCategory, syncedDraftsAreAllowed} from 'mattermost-redux/selectors/entities/preferences';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {updateUserActive, revokeAllSessionsForUser} from 'mattermost-redux/actions/users';

import {Preferences} from 'utils/constants';

import {GlobalState} from 'types/store';
import {ActionFunc} from 'mattermost-redux/types/actions';

import AdvancedSettingsDisplay, {Props} from './user_settings_advanced';

function makeMapStateToProps() {
    const getAdvancedSettingsCategory = makeGetCategory();

    return (state: GlobalState) => {
        const config = getConfig(state);

        const enableUserDeactivation = config.EnableUserDeactivation === 'true';

        return {
            advancedSettingsCategory: getAdvancedSettingsCategory(state, Preferences.CATEGORY_ADVANCED_SETTINGS),
            sendOnCtrlEnter: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter', 'false'),
            codeBlockOnCtrlEnter: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'code_block_ctrl_enter', 'true'),
            formatting: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'formatting', 'true'),
            joinLeave: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'join_leave', 'true'),
            syncDrafts: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'sync_drafts', 'true'),
            currentUser: getCurrentUser(state),
            unreadScrollPosition: getUnreadScrollPositionPreference(state),
            enableUserDeactivation,
            syncedDraftsAreAllowed: syncedDraftsAreAllowed(state),
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
