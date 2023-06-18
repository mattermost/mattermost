// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionCreatorsMapObject, Dispatch, bindActionCreators} from 'redux';

import {connect} from 'react-redux';

import {GlobalState} from 'types/store';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {getTeam as fetchTeam, membersMinusGroupMembers, patchTeam, removeUserFromTeam, updateTeamMemberSchemeRoles, addUserToTeam, deleteTeam, unarchiveTeam} from 'mattermost-redux/actions/teams';
import {getAllGroups, getGroupsAssociatedToTeam} from 'mattermost-redux/selectors/entities/groups';
import {
    getGroupsAssociatedToTeam as fetchAssociatedGroups,
    linkGroupSyncable,
    unlinkGroupSyncable,
    patchGroupSyncable,
} from 'mattermost-redux/actions/groups';
import {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';

import {setNavigationBlocked} from 'actions/admin_actions';

import TeamDetails, {Props as TeamDetailsProps} from './team_details';

function mapStateToProps(state: GlobalState, props: TeamDetailsProps) {
    const teamID: string = props.teamID;
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

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
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
