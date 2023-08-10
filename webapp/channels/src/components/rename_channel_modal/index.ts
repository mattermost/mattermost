// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {patchChannel} from 'mattermost-redux/actions/channels';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {getSiteURL} from 'utils/url';

import RenameChannelModal from './rename_channel_modal';

import type {Channel} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';
import type {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

type Actions = {
    patchChannel(channelId: string, patch: Channel): Promise<{ data: Channel; error: Error }>;
};

const mapStateToPropsRenameChannel = createSelector(
    'mapStateToPropsRenameChannel',
    (state: GlobalState) => {
        const currentTeamId = state.entities.teams.currentTeamId;
        const team = getTeam(state, currentTeamId);
        const currentTeamUrl = `${getSiteURL()}/${team.name}`;
        return {
            currentTeamUrl,
            team,
        };
    },
    (teamInfo) => ({...teamInfo}),
);

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            patchChannel,
        }, dispatch),
    };
}

export default connect(mapStateToPropsRenameChannel, mapDispatchToProps)(RenameChannelModal);
