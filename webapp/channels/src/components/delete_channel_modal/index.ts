// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {GlobalState} from '@mattermost/types/store';
import {ActionFunc} from 'mattermost-redux/types/actions';

import {deleteChannel} from 'actions/views/channel';

import DeleteChannelModal from './delete_channel_modal';

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
