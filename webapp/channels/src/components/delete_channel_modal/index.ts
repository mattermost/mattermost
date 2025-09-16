// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {deleteChannel} from 'actions/views/channel';

import DeleteChannelModal from './delete_channel_modal';

function mapStateToProps(state: GlobalState) {
    return {
        currentTeamDetails: getCurrentTeam(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators(
            {
                deleteChannel,
            },
            dispatch,
        ),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(DeleteChannelModal);
