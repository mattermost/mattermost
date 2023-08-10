// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {deleteChannel} from 'actions/views/channel';

import DeleteChannelModal from './delete_channel_modal';

import type {GlobalState} from '@mattermost/types/store';
import type {ActionFunc} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    return {
        canViewArchivedChannels: config.ExperimentalViewArchivedChannels === 'true',
        currentTeamDetails: getCurrentTeam(state),
    };
}

type Actions = {
    deleteChannel: (channelId: string) => {data: true};
};

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>(
            {
                deleteChannel,
            },
            dispatch,
        ),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(DeleteChannelModal);
