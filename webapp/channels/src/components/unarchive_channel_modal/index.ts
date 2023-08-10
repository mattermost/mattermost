// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {unarchiveChannel} from 'mattermost-redux/actions/channels';

import UnarchiveChannelModal from './unarchive_channel_modal';

import type {ChannelDetailsActions} from './unarchive_channel_modal';
import type {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, ChannelDetailsActions>({
            unarchiveChannel,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(UnarchiveChannelModal);
