// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';

import {updateMe} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {GlobalState} from 'types/store';

import UserSettingsNotifications from './user_settings_notifications';
import {isCallsEnabled, isCallsRingingEnabledOnServer} from 'selectors/calls';

const mapStateToProps = (state: GlobalState) => {
    const config = getConfig(state);

    const sendPushNotifications = config.SendPushNotifications === 'true';
    const enableAutoResponder = config.ExperimentalEnableAutomaticReplies === 'true';

    return {
        sendPushNotifications,
        enableAutoResponder,
        isCollapsedThreadsEnabled: isCollapsedThreadsEnabled(state),
        isCallsRingingEnabled: isCallsEnabled(state, '0.17.0') && isCallsRingingEnabledOnServer(state),
    };
};

const mapDispatchToProps = {
    updateMe,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connect(mapStateToProps, mapDispatchToProps)(UserSettingsNotifications);
