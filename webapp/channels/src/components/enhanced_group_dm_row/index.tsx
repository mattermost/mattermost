// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';
import classNames from 'classnames';

import {CloseIcon} from '@mattermost/compass-icons/components';

import {Client4} from 'mattermost-redux/client';
import {getMyChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {GlobalState} from 'types/store';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

import {getLastPostInChannel} from 'selectors/views/guilded_layout';
import {getRelativeTimestamp} from 'utils/datetime';
import {formatDmPreview} from 'utils/dm_preview_utils';

import './enhanced_group_dm_row.scss';

type Props = {
    channel: Channel;
    users: UserProfile[];
    isActive: boolean;
    onDmClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    onClose?: (channelId: string) => void;
};

const EnhancedGroupDmRow = ({channel, users, isActive, onDmClick, onClose}: Props) => {
    const currentTeamUrl = useSelector(getCurrentRelativeTeamUrl);
    const currentUserId = useSelector(getCurrentUserId);
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
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
    let previewContent: React.ReactNode = 'No messages yet';
    if (lastPost) {
        const isOwnMessage = lastPost.user_id === currentUserId;
        const prefix = isOwnMessage ? 'You: ' : (lastPostUser ? `${lastPostUser.username}: ` : '');
        const formatted = formatDmPreview(lastPost.message);
        previewContent = formatted ? <>{prefix}{formatted}</> : `${prefix}${lastPost.message}`;
    } else if (channel.last_post_at > 0) {
        previewContent = 'Loading...';
    }

    const displayName = useMemo(() => {
        if (channel.display_name && !channel.display_name.includes(',')) {
            return channel.display_name;
        }

        const otherUsers = users.filter((u) => u.id !== currentUserId);
        if (otherUsers.length === 0) {
            return channel.display_name;
        }

        return otherUsers.map((u) => displayUsername(u, teammateNameDisplaySetting)).join(', ');
    }, [channel.display_name, users, currentUserId, teammateNameDisplaySetting]);

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
                    <span className='enhanced-group-dm-row__preview'>{previewContent}</span>

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
                <CloseIcon size={18}/>
            </button>
        </Link>
    );
};

export default EnhancedGroupDmRow;
