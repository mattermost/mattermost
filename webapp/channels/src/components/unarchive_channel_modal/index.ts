// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {unarchiveChannel} from 'mattermost-redux/actions/channels';

import {getChannelKind} from 'utils/channel_kind';

import type {GlobalState} from 'types/store';

import UnarchiveChannelModal from './unarchive_channel_modal';

type OwnProps = {
    channel: Channel;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    return {
        channelKind: getChannelKind(state, ownProps.channel),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            unarchiveChannel,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UnarchiveChannelModal);
