// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {leaveChannel} from 'actions/views/channel';

import LeaveChannelModal from './leave_channel_modal';

import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch} from 'redux';

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            leaveChannel,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(LeaveChannelModal);
