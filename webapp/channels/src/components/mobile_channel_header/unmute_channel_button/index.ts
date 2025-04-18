// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {updateChannelNotifyProps} from 'mattermost-redux/actions/channels';

import UnmuteChannelButton from './unmute_channel_button';

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        updateChannelNotifyProps,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(UnmuteChannelButton);
