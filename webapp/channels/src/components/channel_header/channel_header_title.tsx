// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React, {memo, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getRemoteNamesForChannel} from 'mattermost-redux/selectors/entities/shared_channels';
import {fetchSharedChannelsWithRemotes} from 'mattermost-redux/actions/shared_channels';

import ProfilePicture from 'components/profile_picture';
import SharedChannelIndicator from 'components/shared_channel_indicator';
import ArchiveIcon from 'components/widgets/icons/archive_icon';
import BotTag from 'components/widgets/tag/bot_tag';

import {Constants} from 'utils/constants';

import ChannelHeaderTitleDirect from './channel_header_title_direct';
import ChannelHeaderTitleFavorite from './channel_header_title_favorite';
import ChannelHeaderTitleGroup from './channel_header_title_group';

import ChannelHeaderMenu from '../channel_header_menu/channel_header_menu';

type Props = {
    dmUser?: UserProfile;
    gmMembers?: UserProfile[];
}

const ChannelHeaderTitle = ({
    dmUser,
    gmMembers,
}: Props) => {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const remoteNames = useSelector((state) => getRemoteNamesForChannel(state, channel?.id || ''));

    // Fetch shared channel information when the component mounts or the channel changes
    useEffect(() => {
        if (channel?.shared && channel.team_id) {
            dispatch(fetchSharedChannelsWithRemotes(channel.team_id));
        }
    }, [dispatch, channel?.id, channel?.team_id, channel?.shared]);

    if (!channel) {
        return null;
    }

    const isDirect = (channel.type === Constants.DM_CHANNEL);
    const isGroup = (channel.type === Constants.GM_CHANNEL);
    const channelIsArchived = channel.delete_at !== 0;

    let archivedIcon;
    if (channelIsArchived) {
        archivedIcon = <ArchiveIcon className='icon icon__archive icon channel-header-archived-icon svg-text-color'/>;
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
