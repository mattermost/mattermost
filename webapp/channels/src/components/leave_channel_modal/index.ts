// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {leaveChannel} from 'actions/views/channel';
import {GenericAction} from 'mattermost-redux/types/actions';

import LeaveChannelModal from './leave_channel_modal';

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            leaveChannel,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(LeaveChannelModal);
