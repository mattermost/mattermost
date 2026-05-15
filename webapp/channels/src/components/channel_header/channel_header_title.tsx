// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React, {memo} from 'react';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {compassIconForName, useChannelIconOverrideName} from 'components/channel_type_icon';
import ChannelDecoratorRenderer from 'components/channel_decorator_renderer/channel_decorator_renderer';
import ProfilePicture from 'components/profile_picture';
import SharedChannelIndicator from 'components/shared_channel_indicator';
import BotTag from 'components/widgets/tag/bot_tag';

import {useChannelDecorators} from 'hooks/useChannelDecorators';
import {useChannelIconOverrideName} from 'hooks/useChannelIconOverrideName';
import {getArchiveIconComponent} from 'utils/channel_utils';
import {Constants} from 'utils/constants';

import ChannelHeaderTitleDirect from './channel_header_title_direct';
import ChannelHeaderTitleFavorite from './channel_header_title_favorite';
import ChannelHeaderTitleGroup from './channel_header_title_group';

import ChannelHeaderMenu from '../channel_header_menu/channel_header_menu';

type Props = {
    dmUser?: UserProfile;
    gmMembers?: UserProfile[];
    remoteNames?: string[];
}

const ChannelHeaderTitle = ({
    dmUser,
    gmMembers,
    remoteNames,
}: Props) => {
    const channel = useSelector(getCurrentChannel);
    const overrideName = useChannelIconOverrideName(channel ?? undefined);
    const leftDecorators = useChannelDecorators(channel?.id, 'left_of_channel_name');

    if (!channel) {
        return null;
    }

    const isDirect = (channel.type === Constants.DM_CHANNEL);
    const isGroup = (channel.type === Constants.GM_CHANNEL);
    const channelIsArchived = channel.delete_at !== 0;

    let archivedIcon;
    if (channelIsArchived) {
        const OverrideIcon = overrideName ? compassIconForName(overrideName) : null;
        const IconComponent = OverrideIcon ?? getArchiveIconComponent(channel.type);

        archivedIcon = (
            <IconComponent
                className={OverrideIcon ? 'svg-text-color' : 'icon icon__archive channel-header-archived-icon svg-text-color'}
                data-testid='channel-header-archive-icon'
            />
        );
    }

    let sharedIcon;
    if (channel.shared) {
        sharedIcon = (
            <SharedChannelIndicator
                className='shared-channel-icon'
                withTooltip={true}
                remoteNames={remoteNames}
            />
        );
    }

    let channelTitle: ReactNode = channel.display_name;
    if (isDirect) {
        channelTitle = <ChannelHeaderTitleDirect dmUser={dmUser}/>;
    } else if (isGroup) {
        channelTitle = <ChannelHeaderTitleGroup gmMembers={gmMembers}/>;
    }

    if (isDirect && dmUser?.is_bot) {
        return (
            <div
                id='channelHeaderDropdownButton'
                className='channel-header__bot'
            >
                <ChannelHeaderTitleFavorite/>
                {leftDecorators.length > 0 && channel && (
                    <span className='channel-header__decorator-left'>
                        {leftDecorators.map((reg) => (
                            <ChannelDecoratorRenderer
                                key={`${reg.id}:${channel.id}`}
                                registration={reg}
                                channel={channel}
                            />
                        ))}
                    </span>
                )}
                <ProfilePicture
                    src={Client4.getProfilePictureUrl(dmUser.id, dmUser.last_picture_update)}
                    size='sm'
                />
                <strong
                    id='channelHeaderTitle'
                    className='heading'
                >
                    <span>
                        {archivedIcon}
                        {channelTitle}
                    </span>
                </strong>
                <BotTag/>
            </div>
        );
    }

    return (
        <div className='channel-header__top'>
            <ChannelHeaderTitleFavorite/>
            {leftDecorators.length > 0 && channel && (
                <span className='channel-header__decorator-left'>
                    {leftDecorators.map((reg) => (
                        <ChannelDecoratorRenderer
                            key={`${reg.id}:${channel.id}`}
                            registration={reg}
                            channel={channel}
                        />
                    ))}
                </span>
            )}
            {isDirect && dmUser && ( // Check if it's a DM and dmUser is provided
                <ProfilePicture
                    src={Client4.getProfilePictureUrl(dmUser.id, dmUser.last_picture_update)}
                    size='sm'
                    status={channel.status}
                />
            )}
            <ChannelHeaderMenu
                dmUser={dmUser}
                gmMembers={gmMembers}
                sharedIcon={sharedIcon}
                archivedIcon={archivedIcon}
            />
        </div>
    );
};

export default memo(ChannelHeaderTitle);
