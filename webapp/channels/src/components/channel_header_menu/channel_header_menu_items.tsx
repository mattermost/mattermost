// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactNode} from 'react';
import React, {useState} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import {
    getCurrentChannel,
    isCurrentChannelDefault,
    isCurrentChannelFavorite,
    isCurrentChannelMuted,
    getRedirectChannelNameForCurrentTeam,
} from 'mattermost-redux/selectors/entities/channels';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {
    getCurrentUser,
} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';
import {getPenultimateViewedChannelName} from 'selectors/local_storage';
import {getChannelHeaderMenuPluginComponents} from 'selectors/plugins';

import * as Menu from 'components/menu';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import UnarchiveChannelModal from 'components/unarchive_channel_modal';

import MobileChannelHeaderPlug from 'plugins/mobile_channel_header_plug';
import {Constants, ModalIdentifiers} from 'utils/constants';

import ChannelDirectMenu from './channel_header_direct_menu/channel_header_direct_menu';
import ChannelGroupMenu from './channel_header_direct_menu/channel_header_group_menu';
import ChannelPublicMenu from './channel_header_direct_menu/channel_header_public_menu';
import MenuItemCloseChannel from './menu_items/close_channel/close_channel';

import ChannelHeaderTitleDirect from '../channel_header/channel_header_title_direct';
import ChannelHeaderTitleGroup from '../channel_header/channel_header_title_group';

type Props = {
    dmUser?: UserProfile;
    gmMembers?: UserProfile[];
    isMobile: boolean;
    archivedIcon?: JSX.Element;
    sharedIcon?: JSX.Element;
}

export default function ChannelHeaderMenuItems(props: Props): JSX.Element | null {
    const dispatch = useDispatch();
    const intl = useIntl();

    const user = useSelector(getCurrentUser);
    const channel = useSelector(getCurrentChannel);
    const isDefault = useSelector(isCurrentChannelDefault);
    const isFavorite = useSelector(isCurrentChannelFavorite);
    const isMuted = useSelector(isCurrentChannelMuted);
    const isLicensedForLDAPGroups = useSelector(getLicense).LDAPGroups === 'true';
    const currentTeamID = useSelector(getCurrentTeamId);
    const redirectChannelName = useSelector(getRedirectChannelNameForCurrentTeam);
    const penultimateViewedChannelName = useSelector(getPenultimateViewedChannelName) || redirectChannelName;
    const pluginMenuItems = useSelector(getChannelHeaderMenuPluginComponents);

    const isReadonly = false;
    const isPrivate = channel?.type === Constants.PRIVATE_CHANNEL;
    const isGroupConstrained = channel?.group_constrained === true;
    const {dmUser, gmMembers, isMobile, archivedIcon, sharedIcon} = props;
    const [titleMenuOpen, setTitleMenuOpen] = useState(false);
    const channelUnarchivePermission = Permissions.MANAGE_TEAM;

    if (!channel) {
        return null;
    }

    const isDirect = (channel.type === Constants.DM_CHANNEL);
    const isGroup = (channel.type === Constants.GM_CHANNEL);
    const isArchived = channel.delete_at !== 0;

    let channelTitle: ReactNode = channel.display_name;
    if (isDirect) {
        channelTitle = <ChannelHeaderTitleDirect dmUser={dmUser}/>;
    } else if (isGroup) {
        channelTitle = <ChannelHeaderTitleGroup gmMembers={gmMembers}/>;
    }

    const pluginItems = pluginMenuItems.map((item) => {
        return (
            <Menu.Item
                id={item.id + '_pluginmenuitem'}
                key={item.id + '_pluginmenuitem'}
                onClick={() => {
                    if (item.action) {
                        item.action(channel.id);
                    }
                }}
                labels={<span>{item.text}</span>}
            />
        );
    });

    return (
        <Menu.Container
            hideTooltipWhenDisabled={true}
            menuButtonTooltip={{
                id: 'channelHeaderTooltip',
                text: channelTitle as string,
            }}
            menuButton={{
                id: 'channelHeaderDropdownButton',
                class: classNames('channel-header__trigger style--none', {active: titleMenuOpen}),
                children: (
                    <>
                        {archivedIcon}
                        {channelTitle as string}
                        {sharedIcon}
                        <ChevronDownIcon size={16}/>
                    </>
                ),
                'aria-label': intl.formatMessage({
                    id: 'channel_header.menuAriaLabel',
                    defaultMessage: 'Channel Menu',
                }),
            }}
            menu={{
                id: 'channelHeaderDropdownMenu',
            }}
            transformOrigin={{
                horizontal: 'left',
                vertical: 'top',
            }}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}
        >
            {channel.type === Constants.DM_CHANNEL && (
                <ChannelDirectMenu
                    channel={channel}
                    user={user}
                    isMuted={isMuted}
                />
            )}
            {channel.type === Constants.GM_CHANNEL && (
                <ChannelGroupMenu
                    channel={channel}
                    user={user}
                    isMuted={isMuted}
                    isArchived={isArchived}
                    isGroupConstrained={isGroupConstrained}
                    isReadonly={isReadonly}
                />
            )}
            {(channel.type === Constants.OPEN_CHANNEL || channel.type === Constants.PRIVATE_CHANNEL) && (
                <ChannelPublicMenu
                    channel={channel}
                    user={user}
                    isMuted={isMuted}
                    isArchived={isArchived}
                    isGroupConstrained={isGroupConstrained}
                    isReadonly={isReadonly}
                    isDefault={isDefault}
                    isPrivate={isPrivate}
                    isLicensedForLDAPGroups={isLicensedForLDAPGroups}
                />
            )}

            {/* {isMobile && (
                <>
                    <Menu.Separator/>
                    <MenuItemToggleFavoriteChannel
                        channelID={channel.id}
                        isFavorite={isFavorite}
                    />
                    <MenuItemViewPinnedPosts
                        channelID={channel.id}
                    />
                </>

            )} */}

            {isMobile &&
                <MobileChannelHeaderPlug
                    channel={channel}
                    isDropdown={true}
                />}

            {/* <MenuItemCloseMessage
                id='channelCloseMessage'
                channel={channel}
                currentUser={user}
                redirectChannel={redirectChannelName}
            /> */}
            {isArchived && (
                <MenuItemCloseChannel/>
            )}
            <Menu.Separator/>
            {pluginItems}

            <ChannelPermissionGate
                channelId={channel.id}
                teamId={channel.team_id}
                permissions={[channelUnarchivePermission]}
            >
                {channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && isArchived && !isDefault && (
                    <>
                        <Menu.Separator/>
                        <Menu.Item
                            id='channelUnarchiveChannel'
                            onClick={() => {
                                dispatch(
                                    openModal({
                                        modalId: ModalIdentifiers.UNARCHIVE_CHANNEL,
                                        dialogType: UnarchiveChannelModal,
                                        dialogProps: {channel},
                                    }),
                                );
                            }}
                            labels={
                                <FormattedMessage
                                    id='channel_header.unarchive'
                                    defaultMessage='Unarchive Channel'
                                />
                            }
                        />
                    </>
                )}
            </ChannelPermissionGate>
        </Menu.Container>
    );
}
