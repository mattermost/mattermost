// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {showChannelInfo} from 'actions/views/rhs';

import ChannelInfoButton from './channel_info_button';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            showChannelInfo,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(ChannelInfoButton);
