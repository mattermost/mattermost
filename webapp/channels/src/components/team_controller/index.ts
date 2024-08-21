// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import type {RouteComponentProps} from 'react-router-dom';

import {fetchAllMyTeamsChannelsAndChannelMembersREST, fetchChannelsAndMembers, unsetActiveChannelOnServer} from 'mattermost-redux/actions/channels';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getLicense, getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {markChannelAsReadOnFocus} from 'actions/views/channel';
import {getSelectedThreadIdInCurrentTeam} from 'selectors/views/threads';

import {initializeTeam, joinTeam} from 'components/team_controller/actions';

import {checkIfMFARequired} from 'utils/route';

import type {GlobalState} from 'types/store';

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
    const disableRefetchingOnBrowserFocus = config.DisableRefetchingOnBrowserFocus === 'true';
    const disableWakeUpReconnectHandler = config.DisableWakeUpReconnectHandler === 'true';

    return {
        currentTeamId: getCurrentTeamId(state),
        currentChannelId: getCurrentChannelId(state),
        teamsList: getMyTeams(state),
        plugins,
        selectedThreadId: getSelectedThreadIdInCurrentTeam(state),
        mfaRequired: checkIfMFARequired(currentUser, license, config, ownProps.match.url),
        disableRefetchingOnBrowserFocus,
        disableWakeUpReconnectHandler,
    };
}

const mapDispatchToProps = {
    fetchChannelsAndMembers,
    fetchAllMyTeamsChannelsAndChannelMembersREST,
    markChannelAsReadOnFocus,
    initializeTeam,
    joinTeam,
    unsetActiveChannelOnServer,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(TeamController);
