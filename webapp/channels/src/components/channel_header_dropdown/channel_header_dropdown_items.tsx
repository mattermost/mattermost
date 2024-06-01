// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import AddGroupsToChannelModal from 'components/add_groups_to_channel_modal';
import ChannelGroupsManageModal from 'components/channel_groups_manage_modal';
import ChannelInviteModal from 'components/channel_invite_modal';
import ChannelMoveToSubMenuOld from 'components/channel_move_to_sub_menu_old';
import ChannelNotificationsModal from 'components/channel_notifications_modal';
import ConvertChannelModal from 'components/convert_channel_modal';
import ConvertGmToChannelModal from 'components/convert_gm_to_channel_modal';
import DeleteChannelModal from 'components/delete_channel_modal';
import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import EditChannelPurposeModal from 'components/edit_channel_purpose_modal';
import MoreDirectChannels from 'components/more_direct_channels';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import RenameChannelModal from 'components/rename_channel_modal';
import UnarchiveChannelModal from 'components/unarchive_channel_modal';
import Menu from 'components/widgets/menu/menu';

import MobileChannelHeaderPlug from 'plugins/mobile_channel_header_plug';
import {Constants, ModalIdentifiers} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import type {PluginComponent} from 'types/store/plugins';

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
    pluginMenuItems: PluginComponent[];
    isLicensedForLDAPGroups: boolean;
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
            isLicensedForLDAPGroups,
        } = this.props;

        if (!channel) {
            return null;
        }

        const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;
        const isGroupConstrained = channel.group_constrained === true;
        const channelMembersPermission = isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS : Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS;
        const channelPropertiesPermission = isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
        const channelDeletePermission = isPrivate ? Permissions.DELETE_PRIVATE_CHANNEL : Permissions.DELETE_PUBLIC_CHANNEL;
        const channelUnarchivePermission = Permissions.MANAGE_TEAM;

        let divider;
        if (isMobile) {
            divider = (
                <li className='MenuGroup mobile-menu-divider'>
                    <hr/>
                </li>
            );
        }

        const pluginItems = this.props.pluginMenuItems.map((item) => {
            return (
                <Menu.ItemAction
                    id={item.id + '_pluginmenuitem'}
                    key={item.id + '_pluginmenuitem'}
                    onClick={() => {
                        if (item.action) {
                            item.action(channel.id);
                        }
                    }}
                    text={item.text}
                />
            );
        });

        return (
            <React.Fragment>
                <MenuItemToggleInfo
                    show={channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL}
                    channel={channel}
                />
                {/* Remove when this components is migrated to new menus */}
                <ChannelMoveToSubMenuOld
                    channel={channel}
                    openUp={false}
                    inHeaderDropdown={true}
                />
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
                    <Menu.ItemToggleModalRedux
                        id='channelNotificationPreferences'
                        show={channel.type !== Constants.DM_CHANNEL && !isArchived}
                        modalId={ModalIdentifiers.CHANNEL_NOTIFICATIONS}
                        dialogType={ChannelNotificationsModal}
                        dialogProps={{
                            channel,
                            currentUser: user,
                        }}
                        text={localizeMessage('navbar.preferences', 'Notification Preferences')}
                    />
                    <MenuItemToggleMuteChannel
                        id='channelToggleMuteChannel'
                        user={user}
                        channel={channel}
                        isMuted={isMuted}
                    />
                </Menu.Group>

                <Menu.Group divider={divider}>
                    <ChannelPermissionGate
                        channelId={channel.id}
                        teamId={channel.team_id}
                        permissions={[channelMembersPermission]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='channelAddMembers'
                            show={channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && !isArchived && !isDefault && !isGroupConstrained}
                            modalId={ModalIdentifiers.CHANNEL_INVITE}
                            dialogType={ChannelInviteModal}
                            dialogProps={{channel}}
                            text={localizeMessage('navbar.addMembers', 'Add Members')}
                        />
                        <Menu.ItemToggleModalRedux
                            id='channelAddMembers'
                            show={channel.type === Constants.GM_CHANNEL && !isArchived && !isGroupConstrained}
                            modalId={ModalIdentifiers.CREATE_DM_CHANNEL}
                            dialogType={MoreDirectChannels}
                            dialogProps={{isExistingChannel: true}}
                            text={localizeMessage('navbar.addMembers', 'Add Members')}
                        />
                    </ChannelPermissionGate>
                    <MenuItemOpenMembersRHS
                        id='channelViewMembers'
                        channel={channel}
                        show={channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && (isArchived || isDefault)}
                        text={localizeMessage('channel_header.viewMembers', 'View Members')}
                    />
                    <ChannelPermissionGate
                        channelId={channel.id}
                        teamId={channel.team_id}
                        permissions={[channelMembersPermission]}
                    >
                        <Menu.ItemToggleModalRedux
                            id='channelAddGroups'
                            show={channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && !isArchived && !isDefault && isGroupConstrained && isLicensedForLDAPGroups}
                            modalId={ModalIdentifiers.ADD_GROUPS_TO_CHANNEL}
                            dialogType={AddGroupsToChannelModal}
                            text={localizeMessage('navbar.addGroups', 'Add Groups')}
                        />
                        <Menu.ItemToggleModalRedux
                            id='channelManageGroups'
                            show={channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && !isArchived && !isDefault && isGroupConstrained && isLicensedForLDAPGroups}
                            modalId={ModalIdentifiers.MANAGE_CHANNEL_GROUPS}
                            dialogType={ChannelGroupsManageModal}
                            dialogProps={{channelID: channel.id}}
                            text={localizeMessage('navbar_dropdown.manageGroups', 'Manage Groups')}
                        />
                        <MenuItemOpenMembersRHS
                            id='channelManageMembers'
                            channel={channel}
                            show={channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && !isArchived && !isDefault}
                            text={localizeMessage('channel_header.manageMembers', 'Manage Members')}
                            editMembers={!isArchived}
                        />
                    </ChannelPermissionGate>
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
                            text={localizeMessage('channel_header.viewMembers', 'View Members')}
                        />
                    </ChannelPermissionGate>
                </Menu.Group>

                <Menu.Group divider={divider}>
                    <Menu.ItemToggleModalRedux
                        id='channelEditHeader'
                        show={(channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) && !isArchived && !isReadonly}
                        modalId={ModalIdentifiers.EDIT_CHANNEL_HEADER}
                        dialogType={EditChannelHeaderModal}
                        dialogProps={{channel}}
                        text={localizeMessage('channel_header.setConversationHeader', 'Edit Conversation Header')}
                    />

                    <Menu.ItemToggleModalRedux
                        id='convertGMPrivateChannel'
                        show={channel.type === Constants.GM_CHANNEL && !isArchived && !isReadonly && !isGuest(user.roles)}
                        modalId={ModalIdentifiers.CONVERT_GM_TO_CHANNEL}
                        dialogType={ConvertGmToChannelModal}
                        dialogProps={{channel}}
                        text={localizeMessage('sidebar_left.sidebar_channel_menu_convert_to_channel', 'Convert to Private Channel')}
                    />
                </Menu.Group>

                <Menu.Group divider={divider}>
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
                            text={localizeMessage('channel_header.setHeader', 'Edit Channel Header')}
                        />
                        <Menu.ItemToggleModalRedux
                            id='channelEditPurpose'
                            show={!isArchived && !isReadonly && channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL}
                            modalId={ModalIdentifiers.EDIT_CHANNEL_PURPOSE}
                            dialogType={EditChannelPurposeModal}
                            dialogProps={{channel}}
                            text={localizeMessage('channel_header.setPurpose', 'Edit Channel Purpose')}
                        />
                        <Menu.ItemToggleModalRedux
                            id='channelRename'
                            show={!isArchived && channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL}
                            modalId={ModalIdentifiers.RENAME_CHANNEL}
                            dialogType={RenameChannelModal}
                            dialogProps={{channel}}
                            text={localizeMessage('channel_header.rename', 'Rename Channel')}
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
                            text={localizeMessage('channel_header.convert', 'Convert to Private Channel')}
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
                            text={localizeMessage('channel_header.delete', 'Archive Channel')}
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
                <Menu.Group>
                    {pluginItems}
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
                            text={localizeMessage('channel_header.unarchive', 'Unarchive Channel')}
                        />
                    </ChannelPermissionGate>
                </Menu.Group>
            </React.Fragment>
        );
    }
}
