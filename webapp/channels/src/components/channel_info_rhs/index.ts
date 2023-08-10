// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {unfavoriteChannel, favoriteChannel, getChannelStats} from 'mattermost-redux/actions/channels';
import {Permissions} from 'mattermost-redux/constants';
import {getCurrentChannel, isCurrentChannelFavorite, isCurrentChannelMuted, isCurrentChannelArchived, getCurrentChannelStats} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getProfilesInCurrentChannel, getStatusForUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import {muteChannel, unmuteChannel} from 'actions/channel_actions';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide, showChannelFiles, showChannelMembers, showPinnedPosts} from 'actions/views/rhs';
import {getIsMobileView} from 'selectors/views/browser';
import {isModalOpen} from 'selectors/views/modals';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {getDisplayNameByUser, getUserIdFromChannelId} from 'utils/utils';

import RHS from './channel_info_rhs';

import type {Props} from './channel_info_rhs';
import type {AnyAction, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

const EMPTY_CHANNEL_STATS = {
    member_count: 0,
    guest_count: 0,
    pinnedpost_count: 0,
    files_count: 0,
};

function mapStateToProps(state: GlobalState) {
    const channel = getCurrentChannel(state);
    const currentUser = getCurrentUser(state);
    const currentTeam = getCurrentTeam(state);
    const channelStats = getCurrentChannelStats(state) || EMPTY_CHANNEL_STATS;
    const isArchived = isCurrentChannelArchived(state);
    const isFavorite = isCurrentChannelFavorite(state);
    const isMuted = isCurrentChannelMuted(state);
    const isInvitingPeople = isModalOpen(state, ModalIdentifiers.CHANNEL_INVITE) || isModalOpen(state, ModalIdentifiers.CREATE_DM_CHANNEL);
    const isMobile = getIsMobileView(state);

    const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;
    const canManageMembers = haveIChannelPermission(state, currentTeam.id, channel.id, isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS : Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS);
    const canManageProperties = haveIChannelPermission(state, currentTeam.id, channel.id, isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES);

    const channelMembers = getProfilesInCurrentChannel(state);

    const props = {
        channel,
        currentUser,
        currentTeam,
        isArchived,
        isFavorite,
        isMuted,
        isInvitingPeople,
        isMobile,
        canManageMembers,
        canManageProperties,
        channelStats,
        channelMembers,
    } as Props;

    if (channel.type === Constants.DM_CHANNEL) {
        const user = getUser(state, getUserIdFromChannelId(channel.name, currentUser.id));
        props.dmUser = {
            user,
            display_name: getDisplayNameByUser(state, user),
            is_guest: isGuest(user.roles),
            status: getStatusForUserId(state, user.id),
        };
    }

    return props;
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators({
            closeRightHandSide,
            unfavoriteChannel,
            favoriteChannel,
            unmuteChannel,
            muteChannel,
            openModal,
            showChannelFiles,
            showPinnedPosts,
            showChannelMembers,
            getChannelStats,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RHS);
