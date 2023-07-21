// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';
import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {Client4} from 'mattermost-redux/client';

import Markdown from 'components/markdown';
import ProfilePicture from 'components/profile_picture';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import {DMUser} from './channel_info_rhs';
import EditableArea from './components/editable_area';
import LineLimiter from './components/linelimiter';

const Username = styled.p`
    font-family: Metropolis, sans-serif;
    font-size: 18px;
    line-height: 24px;
    color: rgb(var(--center-channel-color-rgb));
    font-weight: 600;
    margin: 0;
`;

const ChannelHeader = styled.div`
    margin-bottom: 12px;
`;

const UserInfoContainer = styled.div`
    display: flex;
    align-items: center;
    margin-bottom: 12px;
`;

const UserAvatar = styled.div`
    .status {
        bottom: 0;
        right: 0;
        height: 18px;
        width: 18px;
        & svg {
            min-height: 14.4px;
        }
    }
`;

const UserInfo = styled.div`
    margin-left: 12px;
    display: flex;
    flex-direction: column;
`;

const UsernameContainer = styled.div`
    display: flex;
    gap: 8px
`;

const UserPosition = styled.div`
    line-height: 20px;

    p {
        margin-bottom: 0;
    }
`;

const ChannelId = styled.div`
    margin-bottom: 12px;
    font-size: 11px;
    line-height: 16px;
    letter-spacing: 0.02em;
    color: rgba(var(--center-channel-color-rgb), .64);
`;

interface Props {
    channel: Channel;
    dmUser: DMUser;
    actions: {
        editChannelHeader: () => void;
    };
}

const AboutAreaDM = ({channel, dmUser, actions}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <>
            <UserInfoContainer>
                <UserAvatar>
                    <ProfilePicture
                        src={Client4.getProfilePictureUrl(dmUser.user.id, dmUser.user.last_picture_update)}
                        isBot={dmUser.user.is_bot}
                        status={dmUser.status ? dmUser.status : undefined}
                        isRHS={true}
                        username={dmUser.display_name}
                        userId={dmUser.user.id}
                        channelId={channel.id}
                        size='xl'
                        popoverPlacement='left'
                    />
                </UserAvatar>
                <UserInfo>
                    <UsernameContainer>
                        <Username>{dmUser.display_name}</Username>
                        {dmUser.user.is_bot && <BotTag/>}
                        {dmUser.is_guest && <GuestTag/>}
                    </UsernameContainer>
                    <UserPosition>
                        <Markdown message={dmUser.user.is_bot ? dmUser.user.bot_description : dmUser.user.position}/>
                    </UserPosition>
                </UserInfo>
            </UserInfoContainer>

            {!dmUser.user.is_bot && (
                <ChannelHeader>
                    <EditableArea
                        content={channel.header && (
                            <LineLimiter
                                maxLines={4}
                                lineHeight={20}
                                moreText={formatMessage({id: 'channel_info_rhs.about_area.channel_header.line_limiter.more', defaultMessage: 'more'})}
                                lessText={formatMessage({id: 'channel_info_rhs.about_area.channel_header.line_limiter.less', defaultMessage: 'less'})}
                            >
                                <Markdown message={channel.header}/>
                            </LineLimiter>
                        )}
                        editable={true}
                        onEdit={actions.editChannelHeader}
                        emptyLabel={formatMessage({id: 'channel_info_rhs.about_area.add_channel_header', defaultMessage: 'Add a channel header'})}
                    />
                </ChannelHeader>
            )}

            <ChannelId>
                {formatMessage({id: 'channel_info_rhs.about_area_id', defaultMessage: 'ID:'})} {channel.id}
            </ChannelId>
        </>
    );
};

export default AboutAreaDM;
