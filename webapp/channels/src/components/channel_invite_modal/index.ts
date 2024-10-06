// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {UserProfile} from '@mattermost/types/users';

import {getTeamStats, getTeamMembersByIds} from 'mattermost-redux/actions/teams';
import {getProfilesNotInChannel, getProfilesInChannel, searchProfiles} from 'mattermost-redux/actions/users';
import {Permissions} from 'mattermost-redux/constants';
import {getRecentProfilesFromDMs} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {makeGetAllAssociatedGroupsForReference} from 'mattermost-redux/selectors/entities/groups';
import {getTeammateNameDisplaySetting, isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam, getMembersInCurrentTeam, getMembersInTeam, getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getProfilesNotInCurrentChannel, getProfilesInCurrentChannel, getProfilesNotInCurrentTeam, getProfilesNotInTeam, getUserStatuses, makeGetProfilesNotInChannel, makeGetProfilesInChannel} from 'mattermost-redux/selectors/entities/users';

import {addUsersToChannel} from 'actions/channel_actions';
import {loadStatusesForProfilesList} from 'actions/status_actions';
import {searchAssociatedGroupsForReference} from 'actions/views/group';
import {closeModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import ChannelInviteModal from './channel_invite_modal';

type OwnProps = {
    channelId?: string;
    teamId?: string;
}

function makeMapStateToProps(initialState: GlobalState, initialProps: OwnProps) {
    const getAllAssociatedGroupsForReference = makeGetAllAssociatedGroupsForReference();
    let doGetProfilesNotInChannel: (state: GlobalState, channelId: string, filters?: any) => UserProfile[];
    if (initialProps.channelId && initialProps.teamId) {
        doGetProfilesNotInChannel = makeGetProfilesNotInChannel();
    }

    let doGetProfilesInChannel: (state: GlobalState, channelId: string, filters?: any) => UserProfile[];
    if (initialProps.channelId && initialProps.teamId) {
        doGetProfilesInChannel = makeGetProfilesInChannel();
    }

    return (state: GlobalState, props: OwnProps) => {
        let profilesNotInCurrentChannel: UserProfile[];
        let profilesInCurrentChannel: UserProfile[];
        let profilesNotInCurrentTeam: UserProfile[];
        let membersInTeam;

        if (props.channelId && props.teamId) {
            profilesNotInCurrentChannel = doGetProfilesNotInChannel(state, props.channelId);
            profilesInCurrentChannel = doGetProfilesInChannel(state, props.channelId);
            profilesNotInCurrentTeam = getProfilesNotInTeam(state, props.teamId);
            membersInTeam = getMembersInTeam(state, props.teamId);
        } else {
            profilesNotInCurrentChannel = getProfilesNotInCurrentChannel(state);
            profilesInCurrentChannel = getProfilesInCurrentChannel(state);
            profilesNotInCurrentTeam = getProfilesNotInCurrentTeam(state);
            membersInTeam = getMembersInCurrentTeam(state);
        }
        const profilesFromRecentDMs = getRecentProfilesFromDMs(state);
        const config = getConfig(state);
        const license = getLicense(state);

        const currentTeam = props.teamId ? getTeam(state, props.teamId) : getCurrentTeam(state);

        const guestAccountsEnabled = config.EnableGuestAccounts === 'true';
        const emailInvitationsEnabled = config.EnableEmailInvitations === 'true';
        const isLicensed = license && license.IsLicensed === 'true';
        const isGroupConstrained = Boolean(currentTeam?.group_constrained);
        const canInviteGuests = !isGroupConstrained && isLicensed && guestAccountsEnabled && haveICurrentTeamPermission(state, Permissions.INVITE_GUEST);
        const enableCustomUserGroups = isCustomGroupsEnabled(state);

        const isGroupsEnabled = enableCustomUserGroups || (license?.IsLicensed === 'true' && license?.LDAPGroups === 'true');

        const userStatuses = getUserStatuses(state);

        const teammateNameDisplaySetting = getTeammateNameDisplaySetting(state);
        const groups = getAllAssociatedGroupsForReference(state, true);

        return {
            profilesNotInCurrentChannel,
            profilesInCurrentChannel,
            profilesNotInCurrentTeam,
            membersInTeam,
            teammateNameDisplaySetting,
            profilesFromRecentDMs,
            userStatuses,
            canInviteGuests,
            emailInvitationsEnabled,
            groups,
            isGroupsEnabled,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            addUsersToChannel,
            getProfilesNotInChannel,
            getProfilesInChannel,
            getTeamStats,
            loadStatusesForProfilesList,
            searchProfiles,
            closeModal,
            searchAssociatedGroupsForReference,
            getTeamMembersByIds,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ChannelInviteModal);
