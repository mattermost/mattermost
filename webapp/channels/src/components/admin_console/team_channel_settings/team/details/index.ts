// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {RouteComponentProps} from 'react-router-dom';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getAccessControlPolicy, getTeamAccessControlPolicy, assignTeamsToAccessControlPolicy, unassignTeamsFromAccessControlPolicy, searchAccessControlPolicies, updateAccessControlPoliciesActive, createAccessControlTeamSyncJob, createAccessControlPolicy, getAccessControlFields, searchUsersForExpression} from 'mattermost-redux/actions/access_control';
import {
    getGroupsAssociatedToTeam as fetchAssociatedGroups,
    linkGroupSyncable,
    unlinkGroupSyncable,
    patchGroupSyncable,
} from 'mattermost-redux/actions/groups';
import {getTeam as fetchTeam, membersMinusGroupMembers, patchTeam, removeUserFromTeam, updateTeamMemberSchemeRoles, addUserToTeam, deleteTeam, unarchiveTeam, getTeamStats} from 'mattermost-redux/actions/teams';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getAllGroups, getGroupsAssociatedToTeam} from 'mattermost-redux/selectors/entities/groups';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {setNavigationBlocked} from 'actions/admin_actions';

import {isMinimumEnterpriseAdvancedLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import TeamDetails from './team_details';

type Params = {
    team_id: string;
};

export type OwnProps = RouteComponentProps<Params>;

function mapStateToProps(state: GlobalState, props: OwnProps) {
    const teamID = props.match.params.team_id;
    const team = getTeam(state, teamID);
    const groups = getGroupsAssociatedToTeam(state, teamID);
    const allGroups = getAllGroups(state);
    const totalGroups = groups.length;
    const config = getConfig(state);
    const license = getLicense(state);
    const isLicensedForLDAPGroups = license.LDAPGroups === 'true';

    // Team ABAC requires Enterprise Advanced plus the team-membership kill
    // switch, mirroring the server enforcement gate.
    const abacSupported = license?.IsLicensed === 'true' &&
        isMinimumEnterpriseAdvancedLicense(license) &&
        config.FeatureFlagTeamMembershipAccessControl === 'true';

    return {
        team,
        groups,
        totalGroups,
        allGroups,
        teamID,
        isLicensedForLDAPGroups,
        abacSupported,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    const assignTeamToAccessControlPolicy = (policyId: string, teamId: string) => {
        return assignTeamsToAccessControlPolicy(policyId, [teamId]);
    };
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
            getTeamAccessControlPolicy,
            getAccessControlPolicy,
            assignTeamToAccessControlPolicy,
            unassignTeamsFromAccessControlPolicy,
            searchPolicies: searchAccessControlPolicies,
            updateAccessControlPoliciesActive,
            createAccessControlTeamSyncJob,
            getTeamStats,
            saveTeamAccessPolicy: createAccessControlPolicy,
            getAccessControlFields,
            searchUsersForExpression,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamDetails);
