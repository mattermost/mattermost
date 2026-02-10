// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, memo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {getPendingReplies} from 'selectors/views/discord_replies';
import {removePendingReply, clearPendingReplies} from 'actions/views/discord_replies';

import type {DiscordReplyData} from 'reducers/views/discord_replies';
import type {DispatchFunc} from 'types/store';

import './pending_replies_bar.scss';

// Single reply chip component
function ReplyChip({
    reply,
    onRemove,
}: {
    reply: DiscordReplyData;
    onRemove: (postId: string) => void;
}) {
    const handleRemove = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove(reply.post_id);
    }, [reply.post_id, onRemove]);

    // Build tooltip with message preview and file type emojis
    const fileEmojis = (reply.file_categories || []).map((cat: string) => {
        const emojiMap: Record<string, string> = {
            image: '🖼️',
            video: '🎥',
            audio: '🎵',
            document: '📄',
            archive: '📦',
            code: '💻',
            file: '📎',
        };
        return emojiMap[cat] || '📎';
    }).join(' ');

    let tooltipText = '';
    if (fileEmojis && reply.text) {
        tooltipText = `${fileEmojis} ${reply.text}`;
    } else if (fileEmojis) {
        tooltipText = fileEmojis;
    } else if (reply.text) {
        tooltipText = reply.text;
    } else {
        tooltipText = '(empty message)';
    }

    return (
        <span
            className='pending-reply-chip'
            data-post-id={reply.post_id}
            title={`"${tooltipText}"`}
        >
            <span className='pending-username'>
                {reply.nickname || reply.username}
            </span>
            <button
                className='pending-chip-remove'
                onClick={handleRemove}
                aria-label={`Remove reply to ${reply.nickname || reply.username}`}
            >
                {'×'}
            </button>
        </span>
    );
}

const PendingRepliesBar = () => {
    const dispatch = useDispatch<DispatchFunc>();
    const config = useSelector(getConfig);
    const pendingReplies = useSelector(getPendingReplies);

    const handleRemoveReply = useCallback((postId: string) => {
        dispatch(removePendingReply(postId));
    }, [dispatch]);

    const handleClearAll = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dispatch(clearPendingReplies());
    }, [dispatch]);

    // Check if feature is enabled
    const isEnabled = config?.FeatureFlagDiscordReplies === 'true';

    // Don't render if feature disabled or no pending replies
    if (!isEnabled || pendingReplies.length === 0) {
        return null;
    }

    return (
        <div className='discord-pending-replies'>
            <span className='pending-label'>
                {'Replying to'}
            </span>
            <span className='pending-targets'>
                {pendingReplies.map((reply) => (
                    <ReplyChip
                        key={reply.post_id}
                        reply={reply}
                        onRemove={handleRemoveReply}
                    />
                ))}
            </span>
            <button
                className='pending-close'
                onClick={handleClearAll}
                title='Cancel all replies'
                aria-label='Cancel all replies'
            >
                {'×'}
            </button>
        </div>
    );
};

export default memo(PendingRepliesBar);
