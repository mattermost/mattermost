// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {patchChannel} from 'mattermost-redux/actions/channels';

import MuteJoinLeaveMessages from './mute_joinleave_messages';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchChannel,
        }, dispatch),
    };
}

const connector = connect(null, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(MuteJoinLeaveMessages);
