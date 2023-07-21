// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';
import {RouteComponentProps} from 'react-router-dom';

import {fetchAllMyTeamsChannelsAndChannelMembersREST, fetchMyChannelsAndMembersREST} from 'mattermost-redux/actions/channels';
import {getLicense, getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {isGraphQLEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {GlobalState} from 'types/store';

import {getSelectedThreadIdInCurrentTeam} from 'selectors/views/threads';

import {markChannelAsReadOnFocus} from 'actions/views/channel';
import {initializeTeam, joinTeam} from 'components/team_controller/actions';
import {fetchChannelsAndMembers} from 'actions/channel_actions';

import {checkIfMFARequired} from 'utils/route';

import TeamController from './team_controller';

type Params = {
    url: string;
    team?: string;
}

export type OwnProps = RouteComponentProps<Params>;

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const license = getLicense(state);
    const config = getConfig(state);
    const currentUser = getCurrentUser(state);
    const plugins = state.plugins.components.NeedsTeamComponent;
    const graphQLEnabled = isGraphQLEnabled(state);
    const disableRefetchingOnBrowserFocus = config.DisableRefetchingOnBrowserFocus === 'true';

    return {
        currentTeamId: getCurrentTeamId(state),
        currentChannelId: getCurrentChannelId(state),
        teamsList: getMyTeams(state),
        plugins,
        selectedThreadId: getSelectedThreadIdInCurrentTeam(state),
        mfaRequired: checkIfMFARequired(currentUser, license, config, ownProps.match.url),
        graphQLEnabled,
        disableRefetchingOnBrowserFocus,
    };
}

const mapDispatchToProps = {
    fetchChannelsAndMembers,
    fetchMyChannelsAndMembersREST,
    fetchAllMyTeamsChannelsAndChannelMembersREST,
    markChannelAsReadOnFocus,
    initializeTeam,
    joinTeam,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(TeamController);
