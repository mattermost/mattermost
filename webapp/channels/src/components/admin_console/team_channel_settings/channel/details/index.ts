// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {getAccessControlPolicy, deleteAccessControlPolicy, assignChannelsToAccessControlPolicy, searchAccessControlPolicies} from 'mattermost-redux/actions/access_control';
import {
    addChannelMember,
    deleteChannel,
    getChannel as fetchChannel,
    getChannelModerations as fetchChannelModerations,
    membersMinusGroupMembers,
    patchChannel,
    patchChannelModerations,
    removeChannelMember,
    unarchiveChannel,
    updateChannelMemberSchemeRoles,
    updateChannelPrivacy,
} from 'mattermost-redux/actions/channels';
import {
    getGroupsAssociatedToChannel as fetchAssociatedGroups,
    linkGroupSyncable,
    patchGroupSyncable,
    unlinkGroupSyncable,
} from 'mattermost-redux/actions/groups';
import {getScheme as loadScheme} from 'mattermost-redux/actions/schemes';
import {getTeam as fetchTeam} from 'mattermost-redux/actions/teams';
import {getChannel, getChannelModerations} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getAllGroups, getGroupsAssociatedToChannel} from 'mattermost-redux/selectors/entities/groups';
import {getScheme} from 'mattermost-redux/selectors/entities/schemes';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {setNavigationBlocked} from 'actions/admin_actions';

import {isMinimumEnterpriseAdvancedLicense, isMinimumEnterpriseLicense, isMinimumProfessionalLicense} from 'utils/license_utils';

import ChannelDetails from './channel_details';

type OwnProps = {
    match: {
        params: {
            channel_id: string;
        };
    };
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);
    const license = getLicense(state);

    const isLicensed = license?.IsLicensed === 'true';

    // Channel Moderation is only available for Professional and above
    const channelModerationEnabled = isLicensed && isMinimumProfessionalLicense(license);

    // Channel Groups is only available for Enterprise and above
    const channelGroupsEnabled = isLicensed && isMinimumEnterpriseLicense(license);

    const abacSupported = isLicensed && isMinimumEnterpriseAdvancedLicense(license) && config.FeatureFlagAttributeBasedAccessControl === 'true';

    const guestAccountsEnabled = config.EnableGuestAccounts === 'true';
    const channelID = ownProps.match.params.channel_id;
    const channel = getChannel(state, channelID);
    const team = channel ? getTeam(state, channel.team_id) : undefined;
    const groups = getGroupsAssociatedToChannel(state, channelID);
    const totalGroups = groups.length;
    const allGroups = getAllGroups(state);
    const channelPermissions = getChannelModerations(state, channelID);
    const teamScheme = team ? getScheme(state, team.scheme_id) : undefined;
    return {
        channelID,
        channel,
        team,
        groups,
        totalGroups,
        allGroups,
        channelPermissions,
        teamScheme,
        guestAccountsEnabled,
        channelModerationEnabled,
        channelGroupsEnabled,
        abacSupported,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    const assignChannelToAccessControlPolicy = (policyId: string, channelId: string) => {
        return assignChannelsToAccessControlPolicy(policyId, [channelId]);
    };
    return {
        actions: bindActionCreators({
            getGroups: fetchAssociatedGroups,
            linkGroupSyncable,
            unlinkGroupSyncable,
            membersMinusGroupMembers,
            setNavigationBlocked: setNavigationBlocked as any,
            getChannel: fetchChannel,
            getTeam: fetchTeam,
            getChannelModerations: fetchChannelModerations,
            patchChannel,
            updateChannelPrivacy,
            patchGroupSyncable,
            patchChannelModerations,
            loadScheme,
            addChannelMember,
            removeChannelMember,
            updateChannelMemberSchemeRoles,
            deleteChannel,
            unarchiveChannel,
            getAccessControlPolicy,
            assignChannelToAccessControlPolicy,
            deleteAccessControlPolicy,
            searchPolicies: searchAccessControlPolicies,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelDetails);
