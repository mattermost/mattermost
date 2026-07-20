// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Team} from '@mattermost/types/teams';

import {
    createAccessControlTeamSyncJob,
    getTeamAccessControlPolicy,
    searchUsersForExpression,
} from 'mattermost-redux/actions/access_control';
import {patchTeam, regenerateTeamInviteId, getTeamStats} from 'mattermost-redux/actions/teams';

import {isTeamMembershipAccessControlEnabled} from 'selectors/general';

import type {GlobalState} from 'types/store';

import TeamAccessTab from './team_access_tab';

export type OwnProps = {
    team: Team;
    areThereUnsavedChanges: boolean;
    showTabSwitchError: boolean;
    setAreThereUnsavedChanges: (unsaved: boolean) => void;
    setShowTabSwitchError: (error: boolean) => void;
};

function mapStateToProps(state: GlobalState) {
    return {
        teamMembershipAccessControlEnabled: isTeamMembershipAccessControlEnabled(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchTeam,
            regenerateTeamInviteId,
            getTeamStats,
            getTeamAccessControlPolicy,
            searchUsersForExpression,
            createAccessControlTeamSyncJob,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(TeamAccessTab);
