// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {patchChannel} from 'mattermost-redux/actions/channels';

import type {GlobalState} from 'types/store';

import RenameChannelModal from './rename_channel_modal';

function mapStateToProps(_state: GlobalState) {
    return {};
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchChannel,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RenameChannelModal);

