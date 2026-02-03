// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import type {Channel, ChannelStats} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';

import ChannelInviteModal from 'components/channel_invite_modal';
import ChannelNotificationsModal from 'components/channel_notifications_modal';
import Scrollbars from 'components/common/scrollbars';
import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import EditChannelPurposeModal from 'components/edit_channel_purpose_modal';
import MoreDirectChannels from 'components/more_direct_channels';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import RenameChannelModal from 'components/rename_channel_modal';
import UnarchiveChannelModal from 'components/unarchive_channel_modal';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {getSiteURL} from 'utils/url';

import type {ModalData} from 'types/actions';

import AboutArea from './about_area';
import Header from './header';
import Menu from './menu';
import TopButtons from './top_buttons';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
`;

const Divider = styled.div`
    width: 88%;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    margin: 0 auto;
`;

const ArchivedNoticeContainer = styled.div`
    margin: 24px 24px 0 24px;
`;

const ArchivedNotice = styled.div`
    .sectionNoticeIcon {
        width: 24px;
        height: 24px;
    }

    .sectionNoticeTitle {
        color: rgba(var(--center-channel-color-rgb), 0.88);
        display: inline;
        align-items: center;
        gap: 8px;
    }

    .sectionNoticeTitle .sectionNoticeButton {
        margin: 0;
        padding: 0;
        display: inline;
        margin: 0 0 2px 4px;
    }
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
        getChannelStats: (channelId: string) => Promise<{data: ChannelStats}>;
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
                dialogProps: {isExistingChannel: true, focusOriginElement: 'channelInfoRHSAddPeopleButton'},
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

    const editChannelName = () => actions.openModal({
        modalId: ModalIdentifiers.RENAME_CHANNEL,
        dialogType: RenameChannelModal,
        dialogProps: {channel, teamName: currentTeam.name},
    });

    const openNotificationSettings = () => actions.openModal({
        modalId: ModalIdentifiers.CHANNEL_NOTIFICATIONS,
        dialogType: ChannelNotificationsModal,
        dialogProps: {channel, currentUser, focusOriginElement: 'channelInfoRHSNotificationSettings'},
    });

    const openUnarchiveChannel = () => actions.openModal({
        modalId: ModalIdentifiers.UNARCHIVE_CHANNEL,
        dialogType: UnarchiveChannelModal,
        dialogProps: {channel},
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
                isMobile={isMobile}
                onClose={actions.closeRightHandSide}
            />
            <Scrollbars
                color='--center-channel-color-rgb'
            >
                <Container>
                    {isArchived && (
                        <ArchivedNoticeContainer className='sectionNoticeContainer warning'>
                            <ArchivedNotice className='sectionNoticeContent'>
                                <i className='icon icon-archive-outline sectionNoticeIcon'/>
                                <div className='sectionNoticeBody'>
                                    <h4 className='sectionNoticeTitle'>
                                        <FormattedMessage
                                            id='channel_info_rhs.archived.title'
                                            defaultMessage='This channel is archived.'
                                        />
                                        {channel.name !== Constants.DEFAULT_CHANNEL && (
                                            <ChannelPermissionGate
                                                channelId={channel.id}
                                                teamId={channel.team_id}
                                                permissions={[Permissions.MANAGE_TEAM]}
                                            >
                                                <button
                                                    type='button'
                                                    className='sectionNoticeButton btn btn-link'
                                                    onClick={() => {
                                                        openUnarchiveChannel();
                                                    }}
                                                >
                                                    <FormattedMessage
                                                        id='channel_info_rhs.archived.unarchive'
                                                        defaultMessage='Unarchive'
                                                    />
                                                </button>
                                            </ChannelPermissionGate>
                                        )}
                                    </h4>
                                </div>
                            </ArchivedNotice>
                        </ArchivedNoticeContainer>
                    )}
                    <TopButtons
                        channelType={channel.type}
                        channelURL={channelURL}
                        isFavorite={isFavorite}
                        isMuted={isMuted}
                        isInvitingPeople={isInvitingPeople}
                        isArchived={isArchived}
                        canAddPeople={!isArchived && canManageMembers}
                        actions={{toggleFavorite, toggleMute, addPeople}}
                    />
                    <AboutArea
                        channel={channel}
                        dmUser={dmUser}
                        gmUsers={gmUsers}
                        canEditChannelProperties={canEditChannelProperties}
                        actions={{
                            editChannelName,
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
                            getChannelStats: actions.getChannelStats,
                        }}
                    />
                </Container>
            </Scrollbars>
        </div>
    );
};

export default memo(ChannelInfoRhs);
