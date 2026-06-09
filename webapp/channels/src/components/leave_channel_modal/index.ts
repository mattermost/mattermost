// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {getMyChannelMemberships, getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {isChannelMuted} from 'mattermost-redux/utils/channel_utils';

import {muteChannel} from 'actions/channel_actions';
import {leaveChannel} from 'actions/views/channel';

import type {GlobalState} from 'types/store';

import LeaveChannelModal from './leave_channel_modal';

type OwnProps = {
    channel: Channel;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const member = getMyChannelMemberships(state)[ownProps.channel.id];

    return {
        currentUserId: getCurrentUserId(state),
        isMuted: isChannelMuted(member),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            leaveChannel,
            muteChannel,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(LeaveChannelModal);
