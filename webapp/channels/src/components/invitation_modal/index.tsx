// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {searchChannels as reduxSearchChannels} from 'mattermost-redux/actions/channels';
import {regenerateTeamInviteId} from 'mattermost-redux/actions/teams';
import {getProfiles, searchProfiles as reduxSearchProfiles} from 'mattermost-redux/actions/users';
import {Permissions} from 'mattermost-redux/constants';
import {getCurrentChannel, getChannelsInCurrentTeam, getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {haveIChannelPermission, haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam, getCurrentTeamId, getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {isAdmin} from 'mattermost-redux/utils/user_utils';

import {
    sendMembersInvites,
    sendGuestsInvites,
    sendMembersInvitesToChannels,
} from 'actions/invite_actions';

import {makeAsyncComponent} from 'components/async_load';

import {Constants} from 'utils/constants';
import {getRoleForTrackFlow} from 'utils/utils';

import type {GlobalState} from 'types/store';

const InvitationModal = makeAsyncComponent('InvitationModal', React.lazy(() => import('./invitation_modal')));

const searchProfiles = (term: string, options = {}) => {
    if (!term) {
        return getProfiles(0, 20, options);
    }
    return reduxSearchProfiles(term, options);
};

const searchChannels = (teamId: string, term: string) => {
    return reduxSearchChannels(teamId, term);
};

type OwnProps = {
    channelToInvite?: Channel;
}

export function mapStateToProps(state: GlobalState, props: OwnProps) {
    const config = getConfig(state);
    const license = getLicense(state);
    const channels = getChannelsInCurrentTeam(state);
    const channelsByName = getChannelsNameMapInCurrentTeam(state);
    const townSquareDisplayName = channelsByName[Constants.DEFAULT_CHANNEL]?.display_name || Constants.DEFAULT_CHANNEL_UI_NAME;

    const currentTeamId = getCurrentTeamId(state);
    const currentTeam = currentTeamId === '' && props.channelToInvite ? getTeam(state, props.channelToInvite.team_id) : getCurrentTeam(state);
    const currentChannel = getCurrentChannel(state);
    const invitableChannels = channels.filter((channel) => {
        if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
            return false;
        }
        if (channel.type === Constants.PRIVATE_CHANNEL) {
            return haveIChannelPermission(state, currentTeam?.id, channel.id, Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS);
        }
        return haveIChannelPermission(state, currentTeam?.id, channel.id, Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS);
    });
    const guestAccountsEnabled = config.EnableGuestAccounts === 'true';
    const emailInvitationsEnabled = config.EnableEmailInvitations === 'true';
    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';
    const isGroupConstrained = Boolean(currentTeam?.group_constrained);
    const canInviteGuests = !isGroupConstrained && isEnterpriseReady && guestAccountsEnabled && haveICurrentTeamPermission(state, Permissions.INVITE_GUEST);
    const isCloud = license.Cloud === 'true';

    const canAddUsers = haveICurrentTeamPermission(state, Permissions.ADD_USER_TO_TEAM);

    return {
        invitableChannels,
        currentTeam,
        canInviteGuests,
        canAddUsers,
        emailInvitationsEnabled,
        isCloud,
        isAdmin: isAdmin(getCurrentUser(state).roles),
        currentChannel,
        townSquareDisplayName,
        roleForTrackFlow: getRoleForTrackFlow(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            sendGuestsInvites,
            sendMembersInvites,
            sendMembersInvitesToChannels,
            regenerateTeamInviteId,
            searchProfiles,
            searchChannels,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(InvitationModal);
