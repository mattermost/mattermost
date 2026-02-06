// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';
import classNames from 'classnames';

import {CloseIcon} from '@mattermost/compass-icons/components';

import {Client4} from 'mattermost-redux/client';
import {getMyChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';

import {GlobalState} from 'types/store';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

import {getLastPostInChannel} from 'selectors/views/guilded_layout';
import {getRelativeTimestamp} from 'utils/datetime';

import './enhanced_group_dm_row.scss';

type Props = {
    channel: Channel;
    users: UserProfile[];
    isActive: boolean;
    onDmClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    onClose?: (channelId: string) => void;
};

const EnhancedGroupDmRow = ({channel, users, isActive, onDmClick, onClose}: Props) => {
    const currentTeamUrl = useSelector(getCurrentTeamUrl);
    const currentUserId = useSelector(getCurrentUserId);
    const member = useSelector((state: GlobalState) => getMyChannelMember(state, channel.id));
    
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

    // Last message preview text
    // In group DMs: show "You: " for own messages, username for others
    let previewText = 'No messages yet';
    if (lastPost) {
        const isOwnMessage = lastPost.user_id === currentUserId;
        const prefix = isOwnMessage ? 'You: ' : (lastPostUser ? `${lastPostUser.username}: ` : '');
        previewText = `${prefix}${lastPost.message}`;
    }

    const displayName = channel.display_name || users.map((u) => u.username).join(', ');

    return (
        <Link
            to={`${currentTeamUrl}/messages/${channel.name}`}
            className={classNames('enhanced-group-dm-row', {
                'enhanced-group-dm-row--active': isActive,
                'enhanced-group-dm-row--unread': isUnread,
            })}
            onClick={onDmClick}
        >
            <div className='enhanced-group-dm-row__avatars'>
                {users.slice(0, 3).map((u, i) => (
                    <div
                        key={u.id}
                        className={classNames('enhanced-group-dm-row__avatar-container', `enhanced-group-dm-row__avatar-container--${i}`)}
                    >
                        <img
                            src={Client4.getProfilePictureUrl(u.id, u.last_picture_update)}
                            alt={`${u.username} avatar`}
                        />
                    </div>
                ))}
                {users.length > 3 && (
                    <div className='enhanced-group-dm-row__avatar-more'>
                        {`+${users.length - 3}`}
                    </div>
                )}
            </div>

            <div className='enhanced-group-dm-row__content'>
                <div className='enhanced-group-dm-row__header'>
                    <span className='enhanced-group-dm-row__display-name'>{displayName}</span>
                    {lastPost && <span className='enhanced-group-dm-row__timestamp'>{timestamp}</span>}
                </div>

                <div className='enhanced-group-dm-row__footer'>
                    <span className='enhanced-group-dm-row__preview'>{previewText}</span>

                    {hasMentions && (
                        <div className='enhanced-group-dm-row__badge'>
                            {mentionCount}
                        </div>
                    )}
                </div>
            </div>

            <button
                className='enhanced-group-dm-row__close'
                onClick={handleClose}
                aria-label='Close conversation'
            >
                <CloseIcon size={16}/>
            </button>
        </Link>
    );
};

export default EnhancedGroupDmRow;
