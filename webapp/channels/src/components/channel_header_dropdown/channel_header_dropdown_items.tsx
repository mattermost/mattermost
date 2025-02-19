// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import { AppsIcon, ArchiveOutlineIcon, BellOutlineIcon } from '@mattermost/compass-icons/components';
import type { Channel } from '@mattermost/types/channels';
import type { UserProfile } from '@mattermost/types/users';

import { Permissions } from 'mattermost-redux/constants';
import { isGuest } from 'mattermost-redux/utils/user_utils';

import AddGroupsToChannelModal from 'components/add_groups_to_channel_modal';
import ChannelBookmarksSubmenu from 'components/channel_bookmarks_sub_menu';
import ChannelGroupsManageModal from 'components/channel_groups_manage_modal';
import ChannelInviteModal from 'components/channel_invite_modal';
import ChannelMoveToSubMenuOld from 'components/channel_move_to_sub_menu_old';
import ChannelNotificationsModal from 'components/channel_notifications_modal';
import ChannelActionsMenu from 'components/channel_settings';
import type { Actions } from 'components/convert_gm_to_channel_modal';
import DeleteChannelModal from 'components/delete_channel_modal';
import DMChannelSubMenu from 'components/dm_channel_submenu';
import NotChannelSubMenu from 'components/not_channel_submenu';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import UnarchiveChannelModal from 'components/unarchive_channel_modal';
import Menu from 'components/widgets/menu/menu';

import MobileChannelHeaderPlug from 'plugins/mobile_channel_header_plug';
import { Constants, ModalIdentifiers } from 'utils/constants';
import { localizeMessage } from 'utils/utils';


import type { PluginComponent, Menu as PluginMenu } from 'types/store/plugins';
import type {ChannelHeaderAction} from 'types/store/plugins';

import MenuItemCloseChannel from './menu_items/close_channel';
import MenuItemCloseMessage from './menu_items/close_message';
import MenuItemLeaveChannel from './menu_items/leave_channel';
import MenuItemOpenMembersRHS from './menu_items/open_members_rhs';
import MenuItemToggleFavoriteChannel from './menu_items/toggle_favorite_channel';
import MenuItemToggleInfo from './menu_items/toggle_info';
import MenuItemToggleMuteChannel from './menu_items/toggle_mute_channel';
import MenuItemViewPinnedPosts from './menu_items/view_pinned_posts';


export type Props = {
    user: UserProfile;
    channel?: Channel;
    isDefault: boolean;
    isFavorite: boolean;
    isReadonly: boolean;
    isMuted: boolean;
    isArchived: boolean;
    isMobile: boolean;
    penultimateViewedChannelName: string;
    pluginMenuItems: ChannelHeaderAction[];
    isLicensedForLDAPGroups: boolean;
    onExited: () => void;
    actions: Actions;
    profilesInChannel: UserProfile[];
    teammateNameDisplaySetting: string;
    currentUserId: string;
    isChannelBookmarksEnabled: boolean;
}

export default class ChannelHeaderDropdown extends React.PureComponent<Props> {
    render() {
        const {
            user,
            channel,
            isDefault,
            isFavorite,
            isMuted,
            isReadonly,
            isArchived,
            isMobile,
            penultimateViewedChannelName,

            onExited,
            actions,
            profilesInChannel,
            teammateNameDisplaySetting,
            currentUserId,
            isLicensedForLDAPGroups,
            isChannelBookmarksEnabled,
        } = this.props;

        if (!channel) {
            return null;
        }

        const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;
        const channelMembersPermission = isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS : Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS;
        const channelDeletePermission = isPrivate ? Permissions.DELETE_PRIVATE_CHANNEL : Permissions.DELETE_PUBLIC_CHANNEL;
        const channelUnarchivePermission = Permissions.MANAGE_TEAM;

        let divider;
        if (isMobile) {
            divider = (
                <li className='MenuGroup mobile-menu-divider'>
                    <hr />
                </li>
            );
        }

        const pluginItems = this.props.pluginMenuItems.map((item): PluginMenu => {
            return {
                id: item.id,
                text: item.text,
                icon: item.icon,
                action: item.action,
            };
        });

        return (
            <>
                <MenuItemToggleInfo
                    show={true}
                    channel={channel}
                />
                <MenuItemToggleMuteChannel
                    id='channelToggleMuteChannel'
                    user={user}
                    channel={channel}
                    isMuted={isMuted}
                />
                <Menu.ItemToggleModalRedux
                    id='channelNotificationPreferences'
                    show={channel.type !== Constants.DM_CHANNEL && !isArchived}
                    modalId={ModalIdentifiers.CHANNEL_NOTIFICATIONS}
                    dialogType={ChannelNotificationsModal}
                    dialogProps={{
                        channel,
                        currentUser: user,
                    }}
                    text={localizeMessage({ id: 'navbar.preferences', defaultMessage: 'Notification Preferences' })}
                    icon={<BellOutlineIcon size={18} />}
                    style={{ height: '36px' }}
                />
                {(channel.type === Constants.OPEN_CHANNEL || isPrivate) && (
                    <ChannelActionsMenu
                        channel={channel}
                        isArchived={isArchived}
                        isDefault={isDefault}
                        isReadonly={isReadonly}
                    />
                )}
                {channel.type === Constants.GM_CHANNEL && (
                    <NotChannelSubMenu
                        channel={channel}
                        isArchived={isArchived}
                        isReadonly={isReadonly}
                        isGuest={isGuest(user.roles)}
                        onExited={onExited}
                        actions={actions}
                        profilesInChannel={profilesInChannel}
                        teammateNameDisplaySetting={teammateNameDisplaySetting}
                        currentUserId={currentUserId}
                    />
                )}
                {channel.type === Constants.DM_CHANNEL && (
                    <DMChannelSubMenu
                        channel={channel}
                        isArchived={isArchived}
                        isReadonly={isReadonly}
                    />
                )}
                {/* Remove when this components is migrated to new menus */}
                <Menu.Group divider={divider}>
                    <MenuItemToggleFavoriteChannel
                        show={isMobile}
                        channel={channel}
                        isFavorite={isFavorite}
                    />
                    <MenuItemViewPinnedPosts
                        show={isMobile}
                        channel={channel}
                    />
                </Menu.Group>

                <Menu.Group divider={divider}>

                    <MenuItemOpenMembersRHS
                        id='channelViewMembers'
                        channel={channel}
                        show={channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && (isArchived || isDefault)}
                        text={localizeMessage({ id: 'channel_header.viewMembers', defaultMessage: 'Members' })}
                    />
                    <MenuItemOpenMembersRHS
                        id='channelViewMembers'
                        channel={channel}
                        show={channel.type === Constants.GM_CHANNEL}
                        text={localizeMessage({ id: 'channel_header.viewMembers', defaultMessage: 'Members' })}
                    />
                    <ChannelPermissionGate
                        channelId={channel.id}
                        teamId={channel.team_id}
                        permissions={[channelMembersPermission]}
                        invert={true}
                    >
                        <MenuItemOpenMembersRHS
                            id='channelViewMembers'
                            channel={channel}
                            show={channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && !isArchived && !isDefault}
                            text={localizeMessage({ id: 'channel_header.viewMembers', defaultMessage: 'Members' })}
                        />
                    </ChannelPermissionGate>
                </Menu.Group>

                <Menu.Group divider={divider}>
                    <ChannelMoveToSubMenuOld
                        channel={channel}
                        openUp={false}
                        inHeaderDropdown={true}
                    />
                    <Menu.ItemSubMenu
                        id='pluginItems-submenu'
                        subMenu={pluginItems}
                        text={localizeMessage({ id: 'sidebar_left.sidebar_channel_menu.plugins ', defaultMessage: 'More Actions' })}
                        direction='right'
                        icon={<AppsIcon size={18} />}
                    />
                </Menu.Group>
                <Menu.Group divider={divider}>
                    {isChannelBookmarksEnabled && <ChannelBookmarksSubmenu channel={channel}/>}
                    <ChannelPermissionGate
                        channelId={channel.id}
                        teamId={channel.team_id}
                        permissions={[channelPropertiesPermission]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='channelEditHeader'
                            show={channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && !isArchived && !isReadonly}
                            modalId={ModalIdentifiers.EDIT_CHANNEL_HEADER}
                            dialogType={EditChannelHeaderModal}
                            dialogProps={{channel}}
                            text={localizeMessage({id: 'channel_header.setHeader', defaultMessage: 'Edit Channel Header'})}
                        />
                        <Menu.ItemToggleModalRedux
                            id='channelEditPurpose'
                            show={!isArchived && !isReadonly && channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL}
                            modalId={ModalIdentifiers.EDIT_CHANNEL_PURPOSE}
                            dialogType={EditChannelPurposeModal}
                            dialogProps={{channel}}
                            text={localizeMessage({id: 'channel_header.setPurpose', defaultMessage: 'Edit Channel Purpose'})}
                        />
                        <Menu.ItemToggleModalRedux
                            id='channelRename'
                            show={!isArchived && channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL}
                            modalId={ModalIdentifiers.RENAME_CHANNEL}
                            dialogType={RenameChannelModal}
                            dialogProps={{channel}}
                            text={localizeMessage({id: 'channel_header.rename', defaultMessage: 'Rename Channel'})}
                        />
                    </ChannelPermissionGate>
                    <ChannelPermissionGate
                        channelId={channel.id}
                        teamId={channel.team_id}
                        permissions={[Permissions.CONVERT_PUBLIC_CHANNEL_TO_PRIVATE]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='channelConvertToPrivate'
                            show={!isArchived && !isDefault && channel.type === Constants.OPEN_CHANNEL}
                            modalId={ModalIdentifiers.CONVERT_CHANNEL}
                            dialogType={ConvertChannelModal}
                            dialogProps={{
                                channelId: channel.id,
                                channelDisplayName: channel.display_name,
                            }}
                            text={localizeMessage({id: 'channel_header.convert', defaultMessage: 'Convert to Private Channel'})}
                        />
                    </ChannelPermissionGate>
                    <MenuItemLeaveChannel
                        id='channelLeaveChannel'
                        channel={channel}
                        isDefault={isDefault}
                        isGuestUser={isGuest(user.roles)}
                    />
                    <ChannelPermissionGate
                        channelId={channel.id}
                        teamId={channel.team_id}
                        permissions={[channelDeletePermission]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='channelArchiveChannel'
                            show={!isArchived && !isDefault && channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL}
                            modalId={ModalIdentifiers.DELETE_CHANNEL}
                            className='MenuItem__dangerous'
                            dialogType={DeleteChannelModal}
                            dialogProps={{
                                channel,
                                penultimateViewedChannelName,
                            }}
                            text={localizeMessage({ id: 'channel_header.delete', defaultMessage: 'Archive Channel' })}
                            icon={<ArchiveOutlineIcon size={18} />}
                        />
                    </ChannelPermissionGate>
                    {isMobile &&
                        <MobileChannelHeaderPlug
                            channel={channel}
                            isDropdown={true}
                        />}
                    <MenuItemCloseMessage
                        id='channelCloseMessage'
                        channel={channel}
                        currentUser={user}
                    />
                    <MenuItemCloseChannel
                        isArchived={isArchived}
                    />
                </Menu.Group>

                <Menu.Group divider={divider}>
                    <ChannelPermissionGate
                        channelId={channel.id}
                        teamId={channel.team_id}
                        permissions={[channelUnarchivePermission]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='channelUnarchiveChannel'
                            show={isArchived && !isDefault && channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL}
                            modalId={ModalIdentifiers.UNARCHIVE_CHANNEL}
                            dialogType={UnarchiveChannelModal}
                            dialogProps={{
                                channel,
                            }}
                            text={localizeMessage({ id: 'channel_header.unarchive', defaultMessage: 'Unarchive Channel' })}
                        />
                    </ChannelPermissionGate>
                </Menu.Group>
            </>
        );
    }
}


