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
import * as Menu from 'components/menu';
import ChannelMoveToSubmenu from 'components/channel_move_to_sub_menu';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {copyToClipboard} from 'utils/utils';

import type {PropsFromRedux, OwnProps} from './index';
import ConvertGmToChannelModal from "components/convert_gm_to_channel_modal";

type Props = PropsFromRedux & OwnProps;

const SidebarChannelMenu = (props: Props) => {
    const isLeaving = useRef(false);

    const {formatMessage} = useIntl();

    let markAsReadUnreadMenuItem: JSX.Element | null = null;
    if (props.isUnread) {
        function handleMarkAsRead() {
            props.markChannelAsRead(props.channel.id);
            trackEvent('ui', 'ui_sidebar_channel_menu_markAsRead');
        }

        markAsReadUnreadMenuItem = (
            <Menu.Item
                id={`markAsRead-${props.channel.id}`}
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
            props.markMostRecentPostInChannelAsUnread(props.channel.id);
            trackEvent('ui', 'ui_sidebar_channel_menu_markAsUnread');
        }

        markAsReadUnreadMenuItem = (
            <Menu.Item
                id={`markAsUnread-${props.channel.id}`}
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
    if (props.isFavorite) {
        function handleUnfavoriteChannel() {
            props.unfavoriteChannel(props.channel.id);
            trackEvent('ui', 'ui_sidebar_channel_menu_unfavorite');
        }

        favoriteUnfavoriteMenuItem = (
            <Menu.Item
                id={`unfavorite-${props.channel.id}`}
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
            props.favoriteChannel(props.channel.id);
            trackEvent('ui', 'ui_sidebar_channel_menu_favorite');
        }

        favoriteUnfavoriteMenuItem = (

            <Menu.Item
                id={`favorite-${props.channel.id}`}
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
    if (props.isMuted) {
        let muteChannelText = (
            <FormattedMessage
                id='sidebar_left.sidebar_channel_menu.unmuteChannel'
                defaultMessage='Unmute Channel'
            />
        );
        if (props.channel.type === Constants.DM_CHANNEL || props.channel.type === Constants.GM_CHANNEL) {
            muteChannelText = (
                <FormattedMessage
                    id='sidebar_left.sidebar_channel_menu.unmuteConversation'
                    defaultMessage='Unmute Conversation'
                />
            );
        }

        function handleUnmuteChannel() {
            props.unmuteChannel(props.currentUserId, props.channel.id);
        }

        muteUnmuteChannelMenuItem = (
            <Menu.Item
                id={`unmute-${props.channel.id}`}
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
        if (props.channel.type === Constants.DM_CHANNEL || props.channel.type === Constants.GM_CHANNEL) {
            muteChannelText = (
                <FormattedMessage
                    id='sidebar_left.sidebar_channel_menu.muteConversation'
                    defaultMessage='Mute Conversation'
                />
            );
        }

        function handleMuteChannel() {
            props.muteChannel(props.currentUserId, props.channel.id);
        }

        muteUnmuteChannelMenuItem = (
            <Menu.Item
                id={`mute-${props.channel.id}`}
                onClick={handleMuteChannel}
                leadingElement={<BellOutlineIcon size={18}/>}
                labels={muteChannelText}
            />
        );
    }

    let copyLinkMenuItem: JSX.Element | null = null;
    if (props.channel.type === Constants.OPEN_CHANNEL || props.channel.type === Constants.PRIVATE_CHANNEL) {
        function handleCopyLink() {
            copyToClipboard(props.channelLink);
        }

        copyLinkMenuItem = (
            <Menu.Item
                id={`copyLink-${props.channel.id}`}
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
    if ((props.channel.type === Constants.PRIVATE_CHANNEL && props.managePrivateChannelMembers) || (props.channel.type === Constants.OPEN_CHANNEL && props.managePublicChannelMembers)) {
        function handleAddMembers() {
            props.openModal({
                modalId: ModalIdentifiers.CHANNEL_INVITE,
                dialogType: ChannelInviteModal,
                dialogProps: {channel: props.channel},
            });
            trackEvent('ui', 'ui_sidebar_channel_menu_addMembers');
        }

        addMembersMenuItem = (
            <Menu.Item
                id={`addMembers-${props.channel.id}`}
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
    if (props.channel.name !== Constants.DEFAULT_CHANNEL) {
        let leaveChannelText = (
            <FormattedMessage
                id='sidebar_left.sidebar_channel_menu.leaveChannel'
                defaultMessage='Leave Channel'
            />
        );
        if (props.channel.type === Constants.DM_CHANNEL || props.channel.type === Constants.GM_CHANNEL) {
            leaveChannelText = (
                <FormattedMessage
                    id='sidebar_left.sidebar_channel_menu.leaveConversation'
                    defaultMessage='Close Conversation'
                />
            );
        }

        function handleLeaveChannel() {
            if (isLeaving.current || !props.channelLeaveHandler) {
                return;
            }

            isLeaving.current = true;

            props.channelLeaveHandler(() => {
                isLeaving.current = false;
            });
            trackEvent('ui', 'ui_sidebar_channel_menu_leave');
        }

        leaveChannelMenuItem = (
            <Menu.Item
                id={`leave-${props.channel.id}`}
                onClick={handleLeaveChannel}
                leadingElement={<ExitToAppIcon size={18}/>}
                labels={leaveChannelText}
                isDestructive={true}
            />
        );
    }

    let convertToChannelMenuItem: JSX.Element | null = null;
    if (props.channel.type === Constants.GM_CHANNEL) {
        let convertToChannelText = (
            <FormattedMessage
                id='sidebar_left.sidebar_channel_menu_convert_to_channel'
                defaultMessage='Convert to a Channel'
            />
        );

        function handleConvertGmToChannel() {
            props.openModal({
                modalId: ModalIdentifiers.CONVERT_GM_TO_CHANNEL,
                dialogType: ConvertGmToChannelModal,
            });
            trackEvent('ui', 'ui_sidebar_channel_menu_convertGmToChannel');
        }

        convertToChannelMenuItem = (
            <Menu.Item
                id={`sidebar_left.sidebar_channel_menu_convert_to_channel`}
                aria-haspopup='true'
                labels={convertToChannelText}
                onClick={handleConvertGmToChannel}
            />
        )
    }

    return (
        <Menu.Container
            menuButton={{
                id: `SidebarChannelMenu-Button-${props.channel.id}`,
                class: 'SidebarMenu_menuButton',
                'aria-label': formatMessage({id: 'sidebar_left.sidebar_channel_menu.editChannel', defaultMessage: 'Channel options'}),
                children: <DotsVerticalIcon size={16}/>,
            }}
            menuButtonTooltip={{
                id: `SidebarChannelMenu-ButtonTooltip-${props.channel.id}`,
                class: 'hidden-xs',
                text: formatMessage({id: 'sidebar_left.sidebar_channel_menu.editChannel', defaultMessage: 'Channel options'}),
            }}
            menu={{
                id: `SidebarChannelMenu-MenuList-${props.channel.id}`,
                'aria-label': formatMessage({id: 'sidebar_left.sidebar_channel_menu.dropdownAriaLabel', defaultMessage: 'Edit channel menu'}),
                onToggle: props.onMenuToggle,
            }}
        >
            {markAsReadUnreadMenuItem}
            {favoriteUnfavoriteMenuItem}
            {muteUnmuteChannelMenuItem}
            <Menu.Separator/>
            <ChannelMoveToSubmenu channel={props.channel}/>
            {convertToChannelMenuItem && <Menu.Separator/>}
            {convertToChannelMenuItem}
            {(copyLinkMenuItem || addMembersMenuItem) && <Menu.Separator/>}
            {copyLinkMenuItem}
            {addMembersMenuItem}
            {leaveChannelMenuItem && <Menu.Separator/>}
            {leaveChannelMenuItem}
        </Menu.Container>
    );
};

export default memo(SidebarChannelMenu);
