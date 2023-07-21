// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelNotifyProps} from '@mattermost/types/channels';
import {connect, ConnectedProps} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {updateChannelNotifyProps} from 'mattermost-redux/actions/channels';
import {getMyCurrentChannelMembership} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {ActionResult} from 'mattermost-redux/types/actions';

import {GlobalState} from 'types/store/index';

import ChannelNotificationsModal from './channel_notifications_modal';

const mapStateToProps = (state: GlobalState) => ({
    channelMember: getMyCurrentChannelMembership(state),
    sendPushNotifications: getConfig(state).SendPushNotifications === 'true',
});

type Actions = {
    updateChannelNotifyProps: (userId: string, channelId: string, props: Partial<ChannelNotifyProps>) => Promise<ActionResult>;
};

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators<ActionCreatorsMapObject, Actions>({
        updateChannelNotifyProps,
    }, dispatch),
});

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>

export default connector(ChannelNotificationsModal);
