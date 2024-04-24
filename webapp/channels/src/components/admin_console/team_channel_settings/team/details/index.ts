// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {RouteComponentProps} from 'react-router-dom';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {
    getGroupsAssociatedToTeam as fetchAssociatedGroups,
    linkGroupSyncable,
    unlinkGroupSyncable,
    patchGroupSyncable,
} from 'mattermost-redux/actions/groups';
import {getTeam as fetchTeam, membersMinusGroupMembers, patchTeam, removeUserFromTeam, updateTeamMemberSchemeRoles, addUserToTeam, deleteTeam, unarchiveTeam} from 'mattermost-redux/actions/teams';
import {getAllGroups, getGroupsAssociatedToTeam} from 'mattermost-redux/selectors/entities/groups';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {setNavigationBlocked} from 'actions/admin_actions';

import type {GlobalState} from 'types/store';

import TeamDetails from './team_details';

type Params = {
    team_id: string;
}

export type OwnProps = RouteComponentProps<Params>;

function mapStateToProps(state: GlobalState, props: OwnProps) {
    const teamID = props.match.params.team_id;
    const team = getTeam(state, teamID);
    const groups = getGroupsAssociatedToTeam(state, teamID);
    const allGroups = getAllGroups(state);
    const totalGroups = groups.length;
    const isLicensedForLDAPGroups = state.entities.general.license.LDAPGroups === 'true';
    return {
        team,
        groups,
        totalGroups,
        allGroups,
        teamID,
        isLicensedForLDAPGroups,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getTeam: fetchTeam,
            getGroups: fetchAssociatedGroups,
            patchTeam,
            linkGroupSyncable,
            unlinkGroupSyncable,
            membersMinusGroupMembers,
            setNavigationBlocked,
            patchGroupSyncable,
            removeUserFromTeam,
            addUserToTeam,
            updateTeamMemberSchemeRoles,
            deleteTeam,
            unarchiveTeam,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamDetails);
