// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, memo, type JSX} from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

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
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {isChannelInManagedCategory} from 'mattermost-redux/selectors/entities/channel_categories';

import MenuItemOpenInNewWindow from 'components/channel_header_menu/menu_items/open_in_new_window';
import ChannelInviteModal from 'components/channel_invite_modal';
import ChannelMoveToSubmenu from 'components/channel_move_to_sub_menu';
import * as Menu from 'components/menu';

import {useChannelKind} from 'hooks/useChannelKind';
import type {KindMessages} from 'utils/channel_kind';
import Constants, {ModalIdentifiers} from 'utils/constants';
import {canPopout, isChannelPopoutWindow} from 'utils/popouts/popout_windows';
import {copyToClipboard} from 'utils/utils';

import type {GlobalState} from 'types/store';

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
    const isInManagedCategory = useSelector((state: GlobalState) => isChannelInManagedCategory(state, channel.id));
    const channelKind = useChannelKind(channel);

    const {formatMessage} = useIntl();

    let markAsReadUnreadMenuItem: JSX.Element | null = null;
    if (isUnread) {
        function handleMarkAsRead() {
            // We use mark multiple to not update the active channel in the server
            readMultipleChannels([channel.id]);
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

    let favoriteItem: JSX.Element;
    if (isFavorite) {
        function handleUnfavoriteChannel() {
            unfavoriteChannel(channel.id);
        }

        favoriteItem = (
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
                disabled={isInManagedCategory}
            />
        );
    } else {
        function handleFavoriteChannel() {
            favoriteChannel(channel.id);
        }

        favoriteItem = (
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
                disabled={isInManagedCategory}
            />
        );
    }

    const favoriteUnfavoriteMenuItem = isInManagedCategory ? (
        <WithTooltip
            title={
                <FormattedMessage
                    id='channelHeader.managedCategoryFavoriteDisabled'
                    defaultMessage='Channels in managed categories cannot be favorited.'
                />
            }
        >
            <div>{favoriteItem}</div>
        </WithTooltip>
    ) : favoriteItem;

    let muteUnmuteChannelMenuItem: JSX.Element | null = null;
    if (isMuted) {
        let muteChannelText = <FormattedMessage {...messages.unmute[channelKind]}/>;
        if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
            muteChannelText = (
                <FormattedMessage
                    id='sidebar_left.sidebar_channel_menu.unmute'
                    defaultMessage='Unmute'
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
        let muteChannelText = <FormattedMessage {...messages.mute[channelKind]}/>;
        if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
            muteChannelText = (
                <FormattedMessage
                    id='sidebar_left.sidebar_channel_menu.mute'
                    defaultMessage='Mute'
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
        let leaveChannelText = <FormattedMessage {...messages.leave[channelKind]}/>;
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
                'aria-label': formatMessage(messages.optionsAriaLabel[channelKind], {channelName: channel.name}),
                children: <DotsVerticalIcon size={16}/>,
            }}
            menuButtonTooltip={{
                class: 'hidden-xs',
                text: formatMessage(messages.options[channelKind]),
            }}
            menu={{
                id: `SidebarChannelMenu-MenuList-${channel.id}`,
                'aria-label': formatMessage(messages.menuAriaLabel[channelKind]),
                onToggle: onMenuToggle,
            }}
        >
            {canPopout() && !isChannelPopoutWindow() && (
                <MenuItemOpenInNewWindow channel={channel}/>
            )}
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

/* eslint-disable formatjs/enforce-placeholders -- values are passed where each message is rendered */
const messages = {
    mute: {
        channel: defineMessage({
            id: 'sidebar_left.sidebar_channel_menu.muteChannel',
            defaultMessage: 'Mute Channel',
        }),
        board: defineMessage({
            id: 'sidebar_left.sidebar_channel_menu.muteChannel.board',
            defaultMessage: 'Mute Board',
        }),
    },
    unmute: {
        channel: defineMessage({
            id: 'sidebar_left.sidebar_channel_menu.unmuteChannel',
            defaultMessage: 'Unmute Channel',
        }),
        board: defineMessage({
            id: 'sidebar_left.sidebar_channel_menu.unmuteChannel.board',
            defaultMessage: 'Unmute Board',
        }),
    },
    leave: {
        channel: defineMessage({
            id: 'sidebar_left.sidebar_channel_menu.leaveChannel',
            defaultMessage: 'Leave Channel',
        }),
        board: defineMessage({
            id: 'sidebar_left.sidebar_channel_menu.leaveChannel.board',
            defaultMessage: 'Leave Board',
        }),
    },
    options: {
        channel: defineMessage({
            id: 'sidebar_left.sidebar_channel_menu.editChannel',
            defaultMessage: 'Channel options',
        }),
        board: defineMessage({
            id: 'sidebar_left.sidebar_channel_menu.editChannel.board',
            defaultMessage: 'Board options',
        }),
    },
    optionsAriaLabel: {
        channel: defineMessage({
            id: 'sidebar_left.sidebar_channel_menu.editChannel.ariaLabel',
            defaultMessage: 'Channel options for {channelName}',
        }),
        board: defineMessage({
            id: 'sidebar_left.sidebar_channel_menu.editChannel.ariaLabel.board',
            defaultMessage: 'Board options for {channelName}',
        }),
    },
    menuAriaLabel: {
        channel: defineMessage({
            id: 'sidebar_left.sidebar_channel_menu.dropdownAriaLabel',
            defaultMessage: 'Edit channel menu',
        }),
        board: defineMessage({
            id: 'sidebar_left.sidebar_channel_menu.dropdownAriaLabel.board',
            defaultMessage: 'Edit board menu',
        }),
    },
} satisfies Record<string, KindMessages>;
/* eslint-enable formatjs/enforce-placeholders */

export default memo(SidebarChannelMenu);
