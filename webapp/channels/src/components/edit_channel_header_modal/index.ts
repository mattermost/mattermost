// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {patchChannel} from 'mattermost-redux/actions/channels';
import {Preferences} from 'mattermost-redux/constants';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import {isBoardChannel} from 'utils/channel_kind';

import type {GlobalState} from 'types/store';

import EditChannelHeaderModal from './edit_channel_header_modal';

function mapStateToProps(state: GlobalState, ownProps: {channel: Channel}) {
    return {
        ctrlSend: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
        isBoard: isBoardChannel(state, ownProps.channel),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchChannel,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(EditChannelHeaderModal);
