// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';
import classNames from 'classnames';

import {CloseIcon} from '@mattermost/compass-icons/components';

import {Client4} from 'mattermost-redux/client';
import {getMyChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getUser, getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

import {GlobalState} from 'types/store';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

import {getLastPostInChannel} from 'selectors/views/guilded_layout';
import {getRelativeTimestamp} from 'utils/datetime';

import ProfilePicture from 'components/profile_picture';

import './enhanced_dm_row.scss';

type Props = {
    channel: Channel;
    user: UserProfile;
    isActive: boolean;
    onDmClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    onClose?: (channelId: string) => void;
};

const EnhancedDmRow = ({channel, user, isActive, onDmClick, onClose}: Props) => {
    const currentTeamUrl = useSelector(getCurrentRelativeTeamUrl);
    const currentUserId = useSelector(getCurrentUserId);
    const member = useSelector((state: GlobalState) => getMyChannelMember(state, channel.id));
    const userStatus = useSelector((state: GlobalState) => getStatusForUserId(state, user.id)) || 'offline';

    // Last post selectors
    const lastPost = useSelector((state: GlobalState) => getLastPostInChannel(state, channel.id));
    const lastPostUser = useSelector((state: GlobalState) => lastPost ? getUser(state, lastPost.user_id) : null);

    const isUnread = member ? member.mention_count > 0 || (member.notify_props?.mark_unread !== 'mention' && member.msg_count < channel.total_msg_count) : false;
    const mentionCount = member?.mention_count || 0;
    const hasMentions = mentionCount > 0;

    // Format timestamp
    const timestamp = lastPost ? getRelativeTimestamp(lastPost.create_at) : '';

    const handleClose = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClose?.(channel.id);
    };

    const avatarUrl = Client4.getProfilePictureUrl(user.id, user.last_picture_update);

    // Last message preview text
    // In 1-on-1 DMs: show "You: " for own messages, no prefix for the other person
    let previewText = 'No messages yet';
    if (lastPost) {
        const isOwnMessage = lastPost.user_id === currentUserId;
        const prefix = isOwnMessage ? 'You: ' : '';
        previewText = `${prefix}${lastPost.message}`;
    }

    return (
        <Link
            to={`${currentTeamUrl}/messages/@${user.username}`}
            className={classNames('enhanced-dm-row', {
                'enhanced-dm-row--active': isActive,
                'enhanced-dm-row--unread': isUnread,
            })}
            onClick={onDmClick}
        >
            <div className='enhanced-dm-row__avatar'>
                <ProfilePicture
                    size='sm'
                    status={userStatus}
                    src={avatarUrl}
                    username={user.username}
                />
            </div>

            <div className='enhanced-dm-row__content'>
                <div className='enhanced-dm-row__header'>
                    <span className='enhanced-dm-row__display-name'>{user.nickname || user.username}</span>
                    {lastPost && <span className='enhanced-dm-row__timestamp'>{timestamp}</span>}
                </div>

                <div className='enhanced-dm-row__footer'>
                    <span className='enhanced-dm-row__preview'>{previewText}</span>

                    {hasMentions && (
                        <div className='enhanced-dm-row__badge'>
                            {mentionCount}
                        </div>
                    )}
                </div>
            </div>

            <button
                className='enhanced-dm-row__close'
                onClick={handleClose}
                aria-label='Close conversation'
            >
                <CloseIcon size={16}/>
            </button>
        </Link>
    );
};

export default EnhancedDmRow;