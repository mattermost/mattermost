// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {updateChannelNotifyProps} from 'mattermost-redux/actions/channels';
import {getMyCurrentChannelMembership} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {
    isCollapsedThreadsEnabled,
} from 'mattermost-redux/selectors/entities/preferences';

import type {GlobalState} from 'types/store/index';

import ChannelNotificationsModal from './channel_notifications_modal';

const mapStateToProps = (state: GlobalState) => ({
    collapsedReplyThreads: isCollapsedThreadsEnabled(state),
    channelMember: getMyCurrentChannelMembership(state),
    sendPushNotifications: getConfig(state).SendPushNotifications === 'true',
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        updateChannelNotifyProps,
    }, dispatch),
});

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>

export default connector(ChannelNotificationsModal);
