// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import styled from 'styled-components';

import {getSiteURL} from 'utils/url';
import ChannelInviteModal from 'components/channel_invite_modal';
import {ModalData} from 'types/actions';
import Constants, {ModalIdentifiers} from 'utils/constants';
import EditChannelPurposeModal from 'components/edit_channel_purpose_modal';
import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import ChannelNotificationsModal from 'components/channel_notifications_modal';
import MoreDirectChannels from 'components/more_direct_channels';

import {Channel, ChannelStats} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';
import {Team} from '@mattermost/types/teams';

import Menu from './menu';
import AboutArea from './about_area';
import TopButtons from './top_buttons';
import Header from './header';

const Divider = styled.div`
    width: 88%;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    margin: 0 auto;
`;

export interface DMUser {
    user: UserProfile;
    display_name: string;
    is_guest: boolean;
    status: string;
}

export interface Props {
    channel: Channel;
    channelStats: ChannelStats;
    currentUser: UserProfile;
    currentTeam: Team;

    isArchived: boolean;
    isFavorite: boolean;
    isMuted: boolean;
    isInvitingPeople: boolean;
    isMobile: boolean;

    canManageMembers: boolean;
    canManageProperties: boolean;

    dmUser?: DMUser;
    channelMembers: UserProfile[];

    actions: {
        closeRightHandSide: () => void;
        unfavoriteChannel: (channelId: string) => void;
        favoriteChannel: (channelId: string) => void;
        unmuteChannel: (userId: string, channelId: string) => void;
        muteChannel: (userId: string, channelId: string) => void;
        openModal: <P>(modalData: ModalData<P>) => void;
        showChannelFiles: (channelId: string) => void;
        showPinnedPosts: (channelId: string | undefined) => void;
        showChannelMembers: (channelId: string) => void;
    };
}

const ChannelInfoRhs = ({
    channel,
    channelStats,
    isArchived,
    isFavorite,
    isMuted,
    isInvitingPeople,
    isMobile,
    currentTeam,
    currentUser,
    dmUser,
    channelMembers,
    canManageMembers,
    canManageProperties,
    actions,
}: Props) => {
    const currentUserId = currentUser.id;
    const channelURL = getSiteURL() + '/' + currentTeam.name + '/channels/' + channel.name;

    const toggleFavorite = () => {
        if (isFavorite) {
            actions.unfavoriteChannel(channel.id);
            return;
        }
        actions.favoriteChannel(channel.id);
    };

    const toggleMute = () => {
        if (isMuted) {
            actions.unmuteChannel(currentUserId, channel.id);
            return;
        }
        actions.muteChannel(currentUserId, channel.id);
    };

    const addPeople = () => {
        if (channel.type === Constants.GM_CHANNEL) {
            return actions.openModal({
                modalId: ModalIdentifiers.CREATE_DM_CHANNEL,
                dialogType: MoreDirectChannels,
                dialogProps: {isExistingChannel: true},
            });
        }

        return actions.openModal({
            modalId: ModalIdentifiers.CHANNEL_INVITE,
            dialogType: ChannelInviteModal,
            dialogProps: {channel},
        });
    };

    const editChannelPurpose = () => actions.openModal({
        modalId: ModalIdentifiers.EDIT_CHANNEL_PURPOSE,
        dialogType: EditChannelPurposeModal,
        dialogProps: {channel},
    });

    const editChannelHeader = () => actions.openModal({
        modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
        dialogType: EditChannelHeaderModal,
        dialogProps: {channel},
    });

    const openNotificationSettings = () => actions.openModal({
        modalId: ModalIdentifiers.CHANNEL_NOTIFICATIONS,
        dialogType: ChannelNotificationsModal,
        dialogProps: {channel, currentUser},
    });

    const gmUsers = channelMembers.filter((user) => {
        return user.id !== currentUser.id;
    });

    const canEditChannelProperties = !isArchived && canManageProperties;

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body'
        >
            <Header
                channel={channel}
                isArchived={isArchived}
                isMobile={isMobile}
                onClose={actions.closeRightHandSide}
            />

            <TopButtons
                channelType={channel.type}
                channelURL={channelURL}

                isFavorite={isFavorite}
                isMuted={isMuted}
                isInvitingPeople={isInvitingPeople}

                canAddPeople={canManageMembers}

                actions={{toggleFavorite, toggleMute, addPeople}}
            />

            <AboutArea
                channel={channel}

                dmUser={dmUser}
                gmUsers={gmUsers}

                canEditChannelProperties={canEditChannelProperties}

                actions={{
                    editChannelHeader,
                    editChannelPurpose,
                }}
            />

            <Divider/>

            <Menu
                channel={channel}
                channelStats={channelStats}
                isArchived={isArchived}
                actions={{
                    openNotificationSettings,
                    showChannelFiles: actions.showChannelFiles,
                    showPinnedPosts: actions.showPinnedPosts,
                    showChannelMembers: actions.showChannelMembers,
                }}
            />
        </div>
    );
};

export default memo(ChannelInfoRhs);
