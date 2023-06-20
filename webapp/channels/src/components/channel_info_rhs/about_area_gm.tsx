// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import Markdown from 'components/markdown';
import ProfilePicture from 'components/profile_picture';
import {Client4} from 'mattermost-redux/client';
import UserProfileElement from 'components/user_profile';

import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

import EditableArea from './components/editable_area';
import LineLimiter from './components/linelimiter';

const Usernames = styled.p`
    font-family: Metropolis, sans-serif;
    font-size: 18px;
    line-height: 24px;
    color: rgb(var(--center-channel-color-rgb));
    font-weight: 600;
    margin: 0;
`;

const ProfilePictures = styled.div`
    margin-bottom: 10px;
`;

interface ProfilePictureContainerProps {
    position: number;
}

const ProfilePictureContainer = styled.div<ProfilePictureContainerProps>`
    display: inline-block;
    position: relative;
    left: ${(props) => props.position * -15}px;

    & img {
        border: 2px solid white;
    }
`;

const UsersArea = styled.div`
    margin-bottom: 12px;
    &.ChannelPurpose--is-dm {
        margin-bottom: 16px;
    }
`;

const ChannelHeader = styled.div`
    margin-bottom: 12px;
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
    gmUsers: UserProfile[];
    actions: {
        editChannelHeader: () => void;
    };
}

const AboutAreaGM = ({channel, gmUsers, actions}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <>
            <UsersArea>
                <ProfilePictures>
                    {gmUsers.map((user, idx) => (
                        <ProfilePictureContainer
                            key={user.id}
                            position={idx}
                        >
                            <ProfilePicture
                                src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                                size='xl'
                                userId={user.id}
                                username={user.username}
                                channelId={channel.id}
                                popoverPlacement='left'
                            />
                        </ProfilePictureContainer>
                    ))}
                </ProfilePictures>
                <Usernames>
                    {gmUsers.map((user, i, {length}) => (
                        <React.Fragment key={user.id}>
                            <UserProfileElement
                                userId={user.id}
                                isRHS={true}
                                channelId={channel.id}
                            />
                            {(i + 1 !== length) && (<span>{', '}</span>)}
                        </React.Fragment>
                    ))}
                </Usernames>
            </UsersArea>

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

            <ChannelId>
                {formatMessage({id: 'channel_info_rhs.about_area_id', defaultMessage: 'ID:'})} {channel.id}
            </ChannelId>
        </>
    );
};

export default AboutAreaGM;
