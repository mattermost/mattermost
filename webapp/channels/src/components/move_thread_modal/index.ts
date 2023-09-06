// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import {bindActionCreators} from 'redux';

import {moveThread} from 'mattermost-redux/actions/posts';

import {joinChannelById, switchToChannel} from 'actions/views/channel';

import type {ActionProps} from './move_thread_modal';
import MoveThreadModal from './move_thread_modal';

export type PropsFromRedux = ConnectedProps<typeof connector>;

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<any>, ActionProps>({
            joinChannelById,
            switchToChannel,
            moveThread,
        }, dispatch),
    };
}
const connector = connect(null, mapDispatchToProps);

export default connector(MoveThreadModal);
