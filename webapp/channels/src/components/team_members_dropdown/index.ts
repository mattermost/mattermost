// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {removeUserFromTeamAndGetStats} from 'actions/team_actions';
import {getChannelStats} from 'mattermost-redux/actions/channels';
import {
    getMyTeamMembers,
    getMyTeamUnreads,
    getTeamStats,
    getTeamMember,
    updateTeamMemberSchemeRoles,
} from 'mattermost-redux/actions/teams';
import {getUser, updateUserActive} from 'mattermost-redux/actions/users';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentRelativeTeamUrl, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {GenericAction} from 'mattermost-redux/types/actions';

import TeamMembersDropdown from './team_members_dropdown';

function mapStateToProps(state: GlobalState) {
    return {
        currentUser: getCurrentUser(state),
        teamUrl: getCurrentRelativeTeamUrl(state),
        currentTeam: getCurrentTeam(state),
        collapsedThreads: isCollapsedThreadsEnabled(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            getMyTeamMembers,
            getMyTeamUnreads,
            getUser,
            getTeamMember,
            getTeamStats,
            getChannelStats,
            updateUserActive,
            updateTeamMemberSchemeRoles,
            removeUserFromTeamAndGetStats,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamMembersDropdown);
