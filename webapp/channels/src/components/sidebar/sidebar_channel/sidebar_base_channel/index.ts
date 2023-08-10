// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {leaveChannel} from 'actions/views/channel';
import {openModal} from 'actions/views/modals';

import SidebarBaseChannel from './sidebar_base_channel';

import type {ConnectedProps} from 'react-redux';
import type {Dispatch} from 'redux';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            leaveChannel,
            openModal,
        }, dispatch),
    };
}

const connector = connect(null, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(SidebarBaseChannel);
