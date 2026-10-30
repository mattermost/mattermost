// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {patchChannel} from 'mattermost-redux/actions/channels';

import {getChannelKind} from 'utils/channel_kind';

import type {GlobalState} from 'types/store';

import RenameChannelModal from './rename_channel_modal';

function mapStateToProps(state: GlobalState, ownProps: {channel: Channel}) {
    return {
        channelKind: getChannelKind(state, ownProps.channel),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchChannel,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RenameChannelModal);

