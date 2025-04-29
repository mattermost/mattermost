// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactNode} from 'react';
import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';
import type {UserProfile} from '@mattermost/types/users';

import {
    getCurrentChannel,
    isCurrentChannelDefault,
    isCurrentChannelFavorite,
    isCurrentChannelMuted,
} from 'mattermost-redux/selectors/entities/channels';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {
    getCurrentUser,
} from 'mattermost-redux/selectors/entities/users';

import {getChannelHeaderMenuPluginComponents} from 'selectors/plugins';

import {getIsChannelBookmarksEnabled} from 'components/channel_bookmarks/utils';
import * as Menu from 'components/menu';

import {Constants} from 'utils/constants';

import ChannelDirectMenu from './channel_header_menu_items/channel_header_direct_menu';
import ChannelGroupMenu from './channel_header_menu_items/channel_header_group_menu';
import ChannelHeaderMobileMenu from './channel_header_menu_items/channel_header_mobile_menu';
import ChannelPublicPrivateMenu from './channel_header_menu_items/channel_header_public_private_menu';

import ChannelHeaderTitleDirect from '../channel_header/channel_header_title_direct';
import ChannelHeaderTitleGroup from '../channel_header/channel_header_title_group';

type Props = {
    dmUser?: UserProfile;
    gmMembers?: UserProfile[];
    archivedIcon?: JSX.Element;
    sharedIcon?: JSX.Element;
    isMobile?: boolean;
}

export default function ChannelHeaderMenu({dmUser, gmMembers, isMobile, archivedIcon, sharedIcon}: Props): JSX.Element | null {
    const intl = useIntl();

    const user = useSelector(getCurrentUser);
    const channel = useSelector(getCurrentChannel);
    const isDefault = useSelector(isCurrentChannelDefault);
    const isFavorite = useSelector(isCurrentChannelFavorite);
    const isMuted = useSelector(isCurrentChannelMuted);
    const isLicensedForLDAPGroups = useSelector(getLicense).LDAPGroups === 'true';
    const pluginMenuItems = useSelector(getChannelHeaderMenuPluginComponents);
    const isChannelBookmarksEnabled = useSelector(getIsChannelBookmarksEnabled);

    const isReadonly = false;

    if (!channel) {
        return null;
    }

    const isDirect = (channel.type === Constants.DM_CHANNEL);
    const isGroup = (channel.type === Constants.GM_CHANNEL);

    let channelTitle: ReactNode = channel.display_name;
    let ariaLabel = intl.formatMessage({
        id: 'channel_header.otherchannel',
        defaultMessage: '{displayName} Channel Menu',
    }, {
        displayName: channel.display_name,
    });
    if (isDirect && dmUser) {
        channelTitle = <ChannelHeaderTitleDirect dmUser={dmUser}/>;
        if (user.id === dmUser.id) {
            ariaLabel = intl.formatMessage({
                id: 'channel_header.directchannel',
                defaultMessage: '{displayName} (you) Channel Menu',
            }, {
                displayName: channel.display_name,
            });
        }
    } else if (isGroup) {
        channelTitle = <ChannelHeaderTitleGroup gmMembers={gmMembers}/>;
    }

    const pluginItems = pluginMenuItems.map((item) => {
        const handlePluginItemClick = () => {
            if (item.action) {
                item.action(channel.id);
            }
        };

        return (
            <Menu.Item
                id={item.id + '_pluginmenuitem'}
                key={item.id + '_pluginmenuitem'}
                onClick={handlePluginItemClick}
                labels={<span>{item.text}</span>}
            />
        );
    });

    return (
        <Menu.Container
            menuButtonTooltip={{
                text: channelTitle as string,
            }}
            menuButton={{
                id: 'channelHeaderDropdownButton',
                class: classNames('channel-header__trigger style--none'),
                children: (
                    <>
                        {archivedIcon}
                        <strong
                            id='channelHeaderTitle'
                            className='heading'
                        >
                            {channelTitle as string}
                        </strong>
                        {sharedIcon}
                        <ChevronDownIcon size={16}/>
                    </>
                ),
                'aria-label': ariaLabel.toLowerCase(),
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
            {isDirect && (
                <ChannelDirectMenu
                    channel={channel}
                    user={user}
                    isMuted={isMuted}
                    pluginItems={pluginItems}
                    isFavorite={isFavorite}
                    isMobile={isMobile || false}
                    isChannelBookmarksEnabled={isChannelBookmarksEnabled}
                />
            )}
            {isGroup && (
                <ChannelGroupMenu
                    channel={channel}
                    user={user}
                    isMuted={isMuted}
                    pluginItems={pluginItems}
                    isFavorite={isFavorite}
                    isMobile={isMobile || false}
                    isChannelBookmarksEnabled={isChannelBookmarksEnabled}
                />
            )}
            {(!isDirect && !isGroup) && (
                <ChannelPublicPrivateMenu
                    channel={channel}
                    user={user}
                    isMuted={isMuted}
                    pluginItems={pluginItems}
                    isFavorite={isFavorite}
                    isMobile={isMobile || false}
                    isDefault={isDefault}
                    isReadonly={isReadonly}
                    isLicensedForLDAPGroups={isLicensedForLDAPGroups}
                    isChannelBookmarksEnabled={isChannelBookmarksEnabled}
                />
            )}

            <ChannelHeaderMobileMenu
                isMobile={isMobile || false}
                pluginItems={pluginItems}
                channel={channel}
            />
        </Menu.Container>
    );
}

