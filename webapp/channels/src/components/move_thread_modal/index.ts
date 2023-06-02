// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {moveThread} from 'mattermost-redux/actions/posts';
import {joinChannelById, switchToChannel} from 'actions/views/channel';

import MoveThreadModal, {ActionProps} from './move_thread_modal';

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