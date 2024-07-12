// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Preferences} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get as getPreference, getFromPreferences} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import type {OwnProps} from './join_leave_section';
import JoinLeaveSection from './join_leave_section';

export function mapStateToProps(state: GlobalState, props: OwnProps) {
    const config = getConfig(state);
    const enableJoinLeaveMessage = config.EnableJoinLeaveMessageByDefault === 'true';

    let joinLeave: string;
    if (props.adminMode && props.userPreferences) {
        joinLeave = getFromPreferences(
            props.userPreferences,
            Preferences.CATEGORY_ADVANCED_SETTINGS,
            Preferences.ADVANCED_FILTER_JOIN_LEAVE,
            enableJoinLeaveMessage.toString(),
        );
    } else {
        joinLeave = getPreference(
            state,
            Preferences.CATEGORY_ADVANCED_SETTINGS,
            Preferences.ADVANCED_FILTER_JOIN_LEAVE,
            enableJoinLeaveMessage.toString(),
        );
    }

    return {
        currentUserId: props.adminMode ? props.currentUserId : getCurrentUserId(state),
        joinLeave,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            savePreferences,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(JoinLeaveSection);
