// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {UserProfile} from '@mattermost/types/users';

import {getTeamStats} from 'mattermost-redux/actions/teams';
import {getProfilesNotInChannel, getProfilesInChannel, searchProfiles} from 'mattermost-redux/actions/users';
import {Permissions} from 'mattermost-redux/constants';
import {getRecentProfilesFromDMs} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam, getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getProfilesNotInCurrentChannel, getProfilesInCurrentChannel, getProfilesNotInCurrentTeam, getProfilesNotInTeam, getUserStatuses, makeGetProfilesNotInChannel, makeGetProfilesInChannel} from 'mattermost-redux/selectors/entities/users';
import type {Action, ActionResult} from 'mattermost-redux/types/actions';

import {addUsersToChannel} from 'actions/channel_actions';
import {loadStatusesForProfilesList} from 'actions/status_actions';
import {closeModal} from 'actions/views/modals';

import type {Value} from 'components/multiselect/multiselect';

import type {GlobalState} from 'types/store';

import ChannelInviteModal from './channel_invite_modal';

type UserProfileValue = Value & UserProfile;

type OwnProps = {
    channelId?: string;
    teamId?: string;
}

function makeMapStateToProps(initialState: GlobalState, initialProps: OwnProps) {
    let doGetProfilesNotInChannel: (state: GlobalState, channelId: string, filters?: any) => UserProfile[];
    if (initialProps.channelId && initialProps.teamId) {
        doGetProfilesNotInChannel = makeGetProfilesNotInChannel();
    }

    let doGetProfilesInChannel: (state: GlobalState, channelId: string, filters?: any) => UserProfile[];
    if (initialProps.channelId && initialProps.teamId) {
        doGetProfilesInChannel = makeGetProfilesInChannel();
    }

    return (state: GlobalState, props: OwnProps) => {
        let profilesNotInCurrentChannel: UserProfileValue[];
        let profilesInCurrentChannel: UserProfileValue[];
        let profilesNotInCurrentTeam: UserProfileValue[];

        if (props.channelId && props.teamId) {
            profilesNotInCurrentChannel = doGetProfilesNotInChannel(state, props.channelId) as UserProfileValue[];
            profilesInCurrentChannel = doGetProfilesInChannel(state, props.channelId) as UserProfileValue[];
            profilesNotInCurrentTeam = getProfilesNotInTeam(state, props.teamId) as UserProfileValue[];
        } else {
            profilesNotInCurrentChannel = getProfilesNotInCurrentChannel(state) as UserProfileValue[];
            profilesInCurrentChannel = getProfilesInCurrentChannel(state) as UserProfileValue[];
            profilesNotInCurrentTeam = getProfilesNotInCurrentTeam(state) as UserProfileValue[];
        }
        const profilesFromRecentDMs = getRecentProfilesFromDMs(state);
        const config = getConfig(state);
        const license = getLicense(state);

        const currentTeam = props.teamId ? getTeam(state, props.teamId) : getCurrentTeam(state);

        const guestAccountsEnabled = config.EnableGuestAccounts === 'true';
        const emailInvitationsEnabled = config.EnableEmailInvitations === 'true';
        const isLicensed = license && license.IsLicensed === 'true';
        const isGroupConstrained = Boolean(currentTeam.group_constrained);
        const canInviteGuests = !isGroupConstrained && isLicensed && guestAccountsEnabled && haveICurrentTeamPermission(state, Permissions.INVITE_GUEST);

        const userStatuses = getUserStatuses(state);

        const teammateNameDisplaySetting = getTeammateNameDisplaySetting(state);

        return {
            profilesNotInCurrentChannel,
            profilesInCurrentChannel,
            profilesNotInCurrentTeam,
            teammateNameDisplaySetting,
            profilesFromRecentDMs,
            userStatuses,
            canInviteGuests,
            emailInvitationsEnabled,
        };
    };
}

type Actions = {
    addUsersToChannel: (channelId: string, userIds: string[]) => Promise<ActionResult>;
    getProfilesNotInChannel: (teamId: string, channelId: string, groupConstrained: boolean, page: number, perPage?: number) => Promise<ActionResult>;
    getTeamStats: (teamId: string) => void;
    loadStatusesForProfilesList: (users: UserProfile[]) => void;
    searchProfiles: (term: string, options: any) => Promise<ActionResult>;
    closeModal: (modalId: string) => void;
    getProfilesInChannel: (channelId: string, page: number, perPage: number, sort: string, options: {active?: boolean}) => Promise<ActionResult>;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            addUsersToChannel,
            getProfilesNotInChannel,
            getProfilesInChannel,
            getTeamStats,
            loadStatusesForProfilesList,
            searchProfiles,
            closeModal,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ChannelInviteModal);
