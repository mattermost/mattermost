// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {updateChannelPrivacy} from 'mattermost-redux/actions/channels';

import {isBoardChannel} from 'utils/channel_kind';

import type {GlobalState} from 'types/store';

import ConvertChannelModal from './convert_channel_modal';

type OwnProps = {
    channelId: string;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    return {
        isBoard: isBoardChannel(state, {id: ownProps.channelId}),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateChannelPrivacy,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ConvertChannelModal);
