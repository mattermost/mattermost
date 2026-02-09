// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useCallback} from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';
import classNames from 'classnames';

import {CloseIcon} from '@mattermost/compass-icons/components';

import {Client4} from 'mattermost-redux/client';
import {getMyChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getUser, getStatusForUserId} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {GlobalState} from 'types/store';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

import {getLastPostInChannel} from 'selectors/views/guilded_layout';
import {getRelativeTimestamp} from 'utils/datetime';
import {formatDmPreview} from 'utils/dm_preview_utils';

import ProfilePicture from 'components/profile_picture';

import './enhanced_dm_row.scss';

type Props = {
    channel: Channel;
    user: UserProfile;
    isActive: boolean;
    onDmClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    onClose?: (channelId: string) => void;
};

const EnhancedDmRow = React.memo(({channel, user, isActive, onDmClick, onClose}: Props) => {
    const currentTeamUrl = useSelector(getCurrentRelativeTeamUrl);
    const currentUserId = useSelector(getCurrentUserId);
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
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

    const handleClose = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClose?.(channel.id);
    }, [onClose, channel.id]);

    const avatarUrl = useMemo(
        () => Client4.getProfilePictureUrl(user.id, user.last_picture_update),
        [user.id, user.last_picture_update],
    );

    // Memoize preview to avoid re-creating React node tree on every render
    const previewContent = useMemo(() => {
        if (lastPost) {
            const isOwnMessage = lastPost.user_id === currentUserId;
            const prefix = isOwnMessage ? 'You: ' : '';
            const formatted = formatDmPreview(lastPost.message);
            return formatted ? <>{prefix}{formatted}</> : `${prefix}${lastPost.message}`;
        }
        if (channel.last_post_at > 0) {
            return 'Loading...';
        }
        return 'No messages yet';
    }, [lastPost?.id, lastPost?.message, lastPost?.user_id, currentUserId, channel.last_post_at]);

    const displayName = displayUsername(user, teammateNameDisplaySetting);

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
                    size='md'
                    status={userStatus}
                    src={avatarUrl}
                    username={user.username}
                />
            </div>

            <div className='enhanced-dm-row__content'>
                <div className='enhanced-dm-row__header'>
                    <span className='enhanced-dm-row__display-name'>{displayName}</span>
                    {lastPost && <span className='enhanced-dm-row__timestamp'>{timestamp}</span>}
                </div>

                <div className='enhanced-dm-row__footer'>
                    <span className='enhanced-dm-row__preview'>{previewContent}</span>

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
                <CloseIcon size={18}/>
            </button>
        </Link>
    );
});

EnhancedDmRow.displayName = 'EnhancedDmRow';

export default EnhancedDmRow;
