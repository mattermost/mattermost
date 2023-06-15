// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {DispatchFunc} from 'mattermost-redux/types/actions';
import {ChannelCategory} from '@mattermost/types/channel_categories';

import {getCategoryInTeamWithChannel} from 'mattermost-redux/selectors/entities/channel_categories';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';

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
    FolderOutlineIcon,
    FolderMoveOutlineIcon,
    ChevronRightIcon,
    CheckIcon,
} from '@mattermost/compass-icons/components';

import {GlobalState} from 'types/store';

import {trackEvent} from 'actions/telemetry_actions';

import {getCategoriesForCurrentTeam} from 'selectors/views/channel_sidebar';

import {addChannelsInSidebar} from 'actions/views/channel_sidebar';
import {openModal} from 'actions/views/modals';

import ChannelInviteModal from 'components/channel_invite_modal';
import EditCategoryModal from 'components/edit_category_modal';
import * as Menu from 'components/menu';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {copyToClipboard} from 'utils/utils';

import type {PropsFromRedux, OwnProps} from './index';

type Props = PropsFromRedux & OwnProps;

const SidebarChannelMenu = (props: Props) => {
    const isLeaving = useRef(false);

    const {formatMessage} = useIntl();

    const dispatch = useDispatch<DispatchFunc>();

    const allChannels = useSelector(getAllChannels);
    const multiSelectedChannelIds = useSelector((state: GlobalState) => state.views.channelSidebar.multiSelectedChannelIds);

    const currentTeam = useSelector(getCurrentTeam);
    const categories = useSelector((state: GlobalState) => {
        return currentTeam ? getCategoriesForCurrentTeam(state) : undefined;
    });
    const currentCategory = useSelector((state: GlobalState) => {
        return currentTeam ? getCategoryInTeamWithChannel(state, currentTeam?.id || '', props.channel.id) : undefined;
    });

    function handleMoveToCategory(categoryId: string) {
        if (currentCategory?.id !== categoryId) {
            dispatch(addChannelsInSidebar(categoryId, props.channel.id));
            trackEvent('ui', 'ui_sidebar_channel_menu_moveToExistingCategory');
        }
    }

    function handleMoveToNewCategory() {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CATEGORY,
            dialogType: EditCategoryModal,
            dialogProps: {
                channelIdsToAdd: multiSelectedChannelIds.indexOf(props.channel.id) === -1 ? [props.channel.id] : multiSelectedChannelIds,
            },
        }));
        trackEvent('ui', 'ui_sidebar_channel_menu_createCategory');
    }

    function createSubmenuItemsForCategoryArray(categories: ChannelCategory[], currentCategory?: ChannelCategory) {
        const allCategories = categories.map((category: ChannelCategory) => {
            let text = <span>{category.display_name}</span>;

            if (category.type === CategoryTypes.FAVORITES) {
                text = (
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_menu.favorites'
                        defaultMessage='Favorites'
                    />
                );
            }
            if (category.type === CategoryTypes.CHANNELS) {
                text = (
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_menu.channels'
                        defaultMessage='Channels'
                    />
                );
            }

            let selectedCategory = null;
            if (currentCategory && currentCategory.display_name === category.display_name) {
                selectedCategory = (
                    <CheckIcon
                        color='var(--button-bg)'
                        size={18}
                    />
                );
            }

            return (
                <Menu.Item
                    id={Menu.createMenuItemId('moveToCategory', props.channel.id, category.id)}
                    key={Menu.createMenuItemId('moveToCategory', props.channel.id, category.id)}
                    leadingElement={category.type === CategoryTypes.FAVORITES ? (<StarOutlineIcon size={18}/>) : (<FolderOutlineIcon size={18}/>)}
                    labels={text}
                    trailingElements={selectedCategory}
                    onClick={() => handleMoveToCategory(category.id)}
                />
            );
        });

        const dividerAndNewCategory = [
            <Menu.Separator key='ChannelMenu-moveToDivider'/>,
            <Menu.Item
                id={Menu.createMenuItemId('moveToNewCategory', props.channel.id)}
                key={Menu.createMenuItemId('moveToNewCategory', props.channel.id)}
                aria-haspopup={true}
                leadingElement={<FolderMoveOutlineIcon size={18}/>}
                labels={
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_menu.moveToNewCategory'
                        defaultMessage='New Category'
                    />
                }
                onClick={handleMoveToNewCategory}
            />,
        ];

        return [...allCategories, ...dividerAndNewCategory];
    }

    function filterCategoriesBasedOnChannelType(categories: ChannelCategory[], isDmOrGm = false) {
        if (isDmOrGm) {
            return categories.filter((category) => category.type !== CategoryTypes.CHANNELS);
        }

        return categories.filter((category) => category.type !== CategoryTypes.DIRECT_MESSAGES);
    }

    function getMoveToCategorySubmenuItems(categories: ChannelCategory[], currentCategory?: ChannelCategory) {
        const isSubmenuOneOfSelectedChannels = multiSelectedChannelIds.includes(props.channel.id);

        // If multiple channels are selected but the menu is open outside of those selected channels
        if (!isSubmenuOneOfSelectedChannels) {
            const isDmOrGm = props.channel.type === Constants.DM_CHANNEL || props.channel.type === Constants.GM_CHANNEL;
            const filteredCategories = filterCategoriesBasedOnChannelType(categories, isDmOrGm);
            return createSubmenuItemsForCategoryArray(filteredCategories, currentCategory);
        }

        const areAllSelectedChannelsDMorGM = multiSelectedChannelIds.every((channelId) => allChannels[channelId].type === Constants.DM_CHANNEL || allChannels[channelId].type === Constants.GM_CHANNEL);
        if (areAllSelectedChannelsDMorGM) {
            const filteredCategories = filterCategoriesBasedOnChannelType(categories, true);
            return createSubmenuItemsForCategoryArray(filteredCategories, currentCategory);
        }

        const areAllSelectedChannelsAreNotDMorGM = multiSelectedChannelIds.every((channelId) => allChannels[channelId].type !== Constants.DM_CHANNEL && allChannels[channelId].type !== Constants.GM_CHANNEL);
        if (areAllSelectedChannelsAreNotDMorGM) {
            const filteredCategories = filterCategoriesBasedOnChannelType(categories, false);
            return createSubmenuItemsForCategoryArray(filteredCategories, currentCategory);
        }

        // If we have a mix of channel types, we need to filter out both the DM and Channel categories
        const filteredCategories = categories.filter((category) => category.type !== CategoryTypes.CHANNELS && category.type !== CategoryTypes.DIRECT_MESSAGES);
        return createSubmenuItemsForCategoryArray(filteredCategories, currentCategory);
    }

    let markAsReadUnreadMenuItem: JSX.Element | null = null;
    if (props.isUnread) {
        function handleMarkAsRead() {
            props.markChannelAsRead(props.channel.id);
            trackEvent('ui', 'ui_sidebar_channel_menu_markAsRead');
        }

        markAsReadUnreadMenuItem = (
            <Menu.Item
                id={Menu.createMenuItemId('markAsRead', props.channel.id)}
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
                id={Menu.createMenuItemId('markAsUnread', props.channel.id)}
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
                id={Menu.createMenuItemId('unfavorite', props.channel.id)}
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
                id={Menu.createMenuItemId('favorite', props.channel.id)}
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
                id={Menu.createMenuItemId('unmute', props.channel.id)}
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
                id={Menu.createMenuItemId('mute', props.channel.id)}
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
                id={Menu.createMenuItemId('copyLink', props.channel.id)}
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
                id={Menu.createMenuItemId('addMembers', props.channel.id)}
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
                id={Menu.createMenuItemId('leave', props.channel.id)}
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
            {categories && (
                <Menu.SubMenu
                    id={Menu.createSubMenuId('moveTo', props.channel.id)}
                    labels={
                        <FormattedMessage
                            id='sidebar_left.sidebar_channel_menu.moveTo'
                            defaultMessage='Move to...'
                        />
                    }
                    leadingElement={<FolderMoveOutlineIcon size={18}/>}
                    trailingElements={<ChevronRightIcon size={16}/>}
                    menuId={`moveTo-${props.channel.id}-menu`}
                    menuAriaLabel={formatMessage({
                        id: 'sidebar_left.sidebar_channel_menu.moveTo.dropdownAriaLabel',
                        defaultMessage: 'Move to submenu',
                    })}
                >
                    {getMoveToCategorySubmenuItems(categories, currentCategory)}
                </Menu.SubMenu>
            )}
            {(copyLinkMenuItem || addMembersMenuItem) && <Menu.Separator/>}
            {copyLinkMenuItem}
            {addMembersMenuItem}
            {leaveChannelMenuItem && <Menu.Separator/>}
            {leaveChannelMenuItem}
        </Menu.Container>
    );
};

export default memo(SidebarChannelMenu);
