// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {deleteChannel} from 'actions/views/channel';

import {getChannelKind} from 'utils/channel_kind';

import type {GlobalState} from 'types/store';

import DeleteChannelModal from './delete_channel_modal';

type OwnProps = {
    channel: Channel;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    return {
        currentTeamDetails: getCurrentTeam(state),
        channelKind: getChannelKind(state, ownProps.channel),
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
