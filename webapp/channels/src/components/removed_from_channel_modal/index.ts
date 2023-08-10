// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';

import RemovedFromChannelModal from './removed_from_channel_modal';

import type {GlobalState} from 'types/store';

type Props = {
    removerId: string;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const remover = getUser(state, ownProps.removerId);
    return {
        currentUserId: getCurrentUserId(state),
        remover: remover && remover.username,
    };
}

export default connect(mapStateToProps)(RemovedFromChannelModal);
