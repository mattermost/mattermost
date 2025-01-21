// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {
    MarkAsUnreadIcon,
    StarIcon,
    StarOutlineIcon,
    BellOutlineIcon,
    BellOffOutlineIcon,
    LinkVariantIcon,
    AccountPlusOutlineIcon,
    DotsVerticalIcon,
    ExitToAppIcon,
} from '@mattermost/compass-icons/components';

import {trackEvent} from 'actions/telemetry_actions';

import ChannelInviteModal from 'components/channel_invite_modal';
import ChannelMoveToSubmenu from 'components/channel_move_to_sub_menu';
import * as Menu from 'components/menu';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {copyToClipboard} from 'utils/utils';

import type {PropsFromRedux, OwnProps} from './index';

type Props = PropsFromRedux & OwnProps;

const SidebarChannelMenu = ({
    channel,
    channelLink,
    currentUserId,
    favoriteChannel,
    isFavorite,
    isMuted,
    isUnread,
    managePrivateChannelMembers,
    managePublicChannelMembers,
    readMultipleChannels,
    markMostRecentPostInChannelAsUnread,
    muteChannel,
    onMenuToggle,
    openModal,
    unfavoriteChannel,
    unmuteChannel,
    channelLeaveHandler,
}: Props) => {
    const isLeaving = useRef(false);

    const {formatMessage} = useIntl();

    let markAsReadUnreadMenuItem: JSX.Element | null = null;
    if (isUnread) {
        function handleMarkAsRead() {
            // We use mark multiple to not update the active channel in the server
            readMultipleChannels([channel.id]);
            trackEvent('ui', 'ui_sidebar_channel_menu_markAsRead');
        }

        markAsReadUnreadMenuItem = (
            <Menu.Item
                id={`markAsRead-${channel.id}`}
                onClick={handleMarkAsRead}
                leadingElement={<MarkAsUnreadIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_menu.markAsRead'
                        defaultMessage='Mark as Read'
                    />
                )}
            />

        );
    } else {
        function handleMarkAsUnread() {
            markMostRecentPostInChannelAsUnread(channel.id);
            trackEvent('ui', 'ui_sidebar_channel_menu_markAsUnread');
        }

        markAsReadUnreadMenuItem = (
            <Menu.Item
                id={`markAsUnread-${channel.id}`}
                onClick={handleMarkAsUnread}
                leadingElement={<MarkAsUnreadIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_menu.markAsUnread'
                        defaultMessage='Mark as Unread'
                    />
                )}
            />
        );
    }

    let favoriteUnfavoriteMenuItem: JSX.Element | null = null;
    if (isFavorite) {
        function handleUnfavoriteChannel() {
            unfavoriteChannel(channel.id);
            trackEvent('ui', 'ui_sidebar_channel_menu_unfavorite');
        }

        favoriteUnfavoriteMenuItem = (
            <Menu.Item
                id={`unfavorite-${channel.id}`}
                onClick={handleUnfavoriteChannel}
                leadingElement={<StarIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_menu.unfavoriteChannel'
                        defaultMessage='Unfavorite'
                    />
                )}
            />
        );
    } else {
        function handleFavoriteChannel() {
            favoriteChannel(channel.id);
            trackEvent('ui', 'ui_sidebar_channel_menu_favorite');
        }

        favoriteUnfavoriteMenuItem = (

            <Menu.Item
                id={`favorite-${channel.id}`}
                onClick={handleFavoriteChannel}
                leadingElement={<StarOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_menu.favoriteChannel'
                        defaultMessage='Favorite'
                    />
                )}
            />
        );
    }

    let muteUnmuteChannelMenuItem: JSX.Element | null = null;
    if (isMuted) {
        let muteChannelText = (
            <FormattedMessage
                id='sidebar_left.sidebar_channel_menu.unmuteChannel'
                defaultMessage='Unmute Channel'
            />
        );
        if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
            muteChannelText = (
                <FormattedMessage
                    id='sidebar_left.sidebar_channel_menu.unmuteConversation'
                    defaultMessage='Unmute Conversation'
                />
            );
        }

        function handleUnmuteChannel() {
            unmuteChannel(currentUserId, channel.id);
        }

        muteUnmuteChannelMenuItem = (
            <Menu.Item
                id={`unmute-${channel.id}`}
                onClick={handleUnmuteChannel}
                leadingElement={<BellOffOutlineIcon size={18}/>}
                labels={muteChannelText}
            />
        );
    } else {
        let muteChannelText = (
            <FormattedMessage
                id='sidebar_left.sidebar_channel_menu.muteChannel'
                defaultMessage='Mute Channel'
            />
        );
        if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
            muteChannelText = (
                <FormattedMessage
                    id='sidebar_left.sidebar_channel_menu.muteConversation'
                    defaultMessage='Mute Conversation'
                />
            );
        }

        function handleMuteChannel() {
            muteChannel(currentUserId, channel.id);
        }

        muteUnmuteChannelMenuItem = (
            <Menu.Item
                id={`mute-${channel.id}`}
                onClick={handleMuteChannel}
                leadingElement={<BellOutlineIcon size={18}/>}
                labels={muteChannelText}
            />
        );
    }

    let copyLinkMenuItem: JSX.Element | null = null;
    if (channel.type === Constants.OPEN_CHANNEL || channel.type === Constants.PRIVATE_CHANNEL) {
        function handleCopyLink() {
            copyToClipboard(channelLink);
        }

        copyLinkMenuItem = (
            <Menu.Item
                id={`copyLink-${channel.id}`}
                onClick={handleCopyLink}
                leadingElement={<LinkVariantIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_menu.copyLink'
                        defaultMessage='Copy Link'
                    />
                )}
            />
        );
    }

    let addMembersMenuItem: JSX.Element | null = null;
    if ((channel.type === Constants.PRIVATE_CHANNEL && managePrivateChannelMembers) || (channel.type === Constants.OPEN_CHANNEL && managePublicChannelMembers)) {
        function handleAddMembers() {
            openModal({
                modalId: ModalIdentifiers.CHANNEL_INVITE,
                dialogType: ChannelInviteModal,
                dialogProps: {channel},
            });
            trackEvent('ui', 'ui_sidebar_channel_menu_addMembers');
        }

        addMembersMenuItem = (
            <Menu.Item
                id={`addMembers-${channel.id}`}
                onClick={handleAddMembers}
                aria-haspopup='true'
                leadingElement={<AccountPlusOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_menu.addMembers'
                        defaultMessage='Add Members'
                    />
                )}
            />
        );
    }

    let leaveChannelMenuItem: JSX.Element | null = null;
    if (channel.name !== Constants.DEFAULT_CHANNEL) {
        let leaveChannelText = (
            <FormattedMessage
                id='sidebar_left.sidebar_channel_menu.leaveChannel'
                defaultMessage='Leave Channel'
            />
        );
        if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
            leaveChannelText = (
                <FormattedMessage
                    id='sidebar_left.sidebar_channel_menu.leaveConversation'
                    defaultMessage='Close Conversation'
                />
            );
        }

        function handleLeaveChannel() {
            if (isLeaving.current || !channelLeaveHandler) {
                return;
            }

            isLeaving.current = true;

            channelLeaveHandler(() => {
                isLeaving.current = false;
            });
            trackEvent('ui', 'ui_sidebar_channel_menu_leave');
        }

        leaveChannelMenuItem = (
            <Menu.Item
                id={`leave-${channel.id}`}
                onClick={handleLeaveChannel}
                leadingElement={<ExitToAppIcon size={18}/>}
                labels={leaveChannelText}
                isDestructive={true}
            />
        );
    }

    return (
        <Menu.Container
            menuButton={{
                id: `SidebarChannelMenu-Button-${channel.id}`,
                class: 'SidebarMenu_menuButton',
                'aria-label': formatMessage({
                    id: 'sidebar_left.sidebar_channel_menu.editChannel.ariaLabel',
                    defaultMessage: 'Channel options for {channelName}',
                }, {channelName: channel.name}),
                children: <DotsVerticalIcon size={16}/>,
            }}
            menuButtonTooltip={{
                class: 'hidden-xs',
                text: formatMessage({id: 'sidebar_left.sidebar_channel_menu.editChannel', defaultMessage: 'Channel options'}),
            }}
            menu={{
                id: `SidebarChannelMenu-MenuList-${channel.id}`,
                'aria-label': formatMessage({id: 'sidebar_left.sidebar_channel_menu.dropdownAriaLabel', defaultMessage: 'Edit channel menu'}),
                onToggle: onMenuToggle,
            }}
        >
            {markAsReadUnreadMenuItem}
            {favoriteUnfavoriteMenuItem}
            {muteUnmuteChannelMenuItem}
            <Menu.Separator/>
            <ChannelMoveToSubmenu channel={channel}/>
            {(copyLinkMenuItem || addMembersMenuItem) && <Menu.Separator/>}
            {copyLinkMenuItem}
            {addMembersMenuItem}
            {leaveChannelMenuItem && <Menu.Separator/>}
            {leaveChannelMenuItem}
        </Menu.Container>
    );
};

export default memo(SidebarChannelMenu);
