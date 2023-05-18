// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {updateMe} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {ActionFunc} from 'mattermost-redux/types/actions';

import {GlobalState} from 'types/store';

import UserSettingsNotifications, {Props} from './user_settings_notifications';
import {suitePluginIds} from 'utils/constants';
import semver from 'semver';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    const sendPushNotifications = config.SendPushNotifications === 'true';
    const enableAutoResponder = config.ExperimentalEnableAutomaticReplies === 'true';
    const isCallsEnabled = semver.gte(state.plugins.plugins[suitePluginIds.calls].version, '0.17.0');

    return {
        sendPushNotifications,
        enableAutoResponder,
        isCollapsedThreadsEnabled: isCollapsedThreadsEnabled(state),
        isCallsEnabled,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            updateMe,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserSettingsNotifications);
