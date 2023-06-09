// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionCreatorsMapObject, Dispatch, bindActionCreators} from 'redux';

import {connect} from 'react-redux';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {getTeam as fetchTeam, membersMinusGroupMembers, patchTeam, removeUserFromTeam, updateTeamMemberSchemeRoles, addUserToTeam, deleteTeam, unarchiveTeam} from 'mattermost-redux/actions/teams';
import {getAllGroups, getGroupsAssociatedToTeam} from 'mattermost-redux/selectors/entities/groups';
import {
    getGroupsAssociatedToTeam as fetchAssociatedGroups,
    linkGroupSyncable,
    unlinkGroupSyncable,
    patchGroupSyncable,
} from 'mattermost-redux/actions/groups';

import {setNavigationBlocked} from 'actions/admin_actions';

import TeamDetails from './team_details';
import {Props as TeamDetailsProps} from './team_details';
import { GlobalState } from 'types/store';
import { Team } from '@mattermost/types/teams';
import { Group } from '@mattermost/types/groups';
import { ActionFunc, GenericAction } from 'mattermost-redux/types/actions';

function mapStateToProps(state: GlobalState, props: TeamDetailsProps) {
    const teamID: string = props.teamID;
    const team: Team = getTeam(state, teamID);
    const groups: Group[] = getGroupsAssociatedToTeam(state, teamID);
    const allGroups: Record<string, Group> = getAllGroups(state);
    const totalGroups: number = groups.length;
    const isLicensedForLDAPGroups: boolean = state.entities.general.license.LDAPGroups === 'true';
    return {
        team,
        groups,
        totalGroups,
        allGroups,
        teamID,
        isLicensedForLDAPGroups,
    };
}

function mapDispatchToProps(dispatch:  Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, TeamDetailsProps['actions']>({
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