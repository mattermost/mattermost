// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {patchChannel} from 'mattermost-redux/actions/channels';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {getSiteURL} from 'utils/url';

import RenameChannelModal from './rename_channel_modal';

const mapStateToPropsRenameChannel = createSelector(
    'mapStateToPropsRenameChannel',
    (state: GlobalState) => {
        const currentTeamId = state.entities.teams.currentTeamId;
        const team = getTeam(state, currentTeamId);
        const currentTeamUrl = `${getSiteURL()}/${team ? team.name : ''}`;
        return {
            currentTeamUrl,
            team,
        };
    },
    (teamInfo) => ({...teamInfo}),
);

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchChannel,
        }, dispatch),
    };
}

export default connect(mapStateToPropsRenameChannel, mapDispatchToProps)(RenameChannelModal);
