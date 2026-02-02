// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, memo} from 'react';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import type {Post} from '@mattermost/types/posts';

import {getTeam, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';
import type {DiscordReplyData} from 'reducers/views/discord_replies';

import {Client4} from 'mattermost-redux/client';

import './discord_reply_preview.scss';

// Maximum length for preview text
const MAX_PREVIEW_LENGTH = 100;

type Props = {
    post: Post;
};

// Create SVG connector for reply lines
function ConnectorSVG({position, height = 18}: {position: 'single' | 'first' | 'middle' | 'last'; height?: number}) {
    // Layout constants (matching CSS)
    const IMG_COL_WIDTH = 53;
    const CONNECTOR_LEFT = 27;
    const GAP = 3;
    const ITEM_SHIFT = 6;
    const H_GAP = 1;
    const V_GAP = 2;

    // Calculated anchor points
    const x = 0;
    const curveR = 6;
    const midY = height / 2;
    const bottomY = height - V_GAP;
    const endX = IMG_COL_WIDTH - CONNECTOR_LEFT - GAP + ITEM_SHIFT - H_GAP;

    let d: string;
    switch (position) {
    case 'single':
        d = `M ${x} ${bottomY} L ${x} ${midY + curveR} Q ${x} ${midY}, ${x + curveR} ${midY} L ${endX} ${midY}`;
        break;
    case 'first':
        d = `M ${x} ${height} L ${x} ${midY + curveR} Q ${x} ${midY}, ${x + curveR} ${midY} L ${endX} ${midY}`;
        break;
    case 'middle':
        d = `M ${x} 0 L ${x} ${height} M ${x} ${midY} L ${endX} ${midY}`;
        break;
    case 'last':
        d = `M ${x} 0 L ${x} ${bottomY} M ${x} ${midY} L ${endX} ${midY}`;
        break;
    }

    return (
        <svg
            width='36'
            height={height}
            style={{overflow: 'visible'}}
        >
            <path
                d={d}
                stroke='#6e6e6e'
                strokeWidth='2'
                fill='none'
                strokeLinecap='round'
                strokeLinejoin='round'
            />
        </svg>
    );
}

// Truncate text to a maximum length
function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 3) + '...';
}

// Format the display text for a reply
function formatReplyPreview(reply: DiscordReplyData): string {
    if (reply.has_image && reply.has_video) {
        return '[media]';
    }
    if (reply.has_image) {
        return reply.text ? `${truncateText(reply.text.split('\n')[0], MAX_PREVIEW_LENGTH)} [image]` : '[image]';
    }
    if (reply.has_video) {
        return reply.text ? `${truncateText(reply.text.split('\n')[0], MAX_PREVIEW_LENGTH)} [video]` : '[video]';
    }
    return truncateText(reply.text?.split('\n')[0] || '', MAX_PREVIEW_LENGTH);
}

// Single reply item component
function ReplyItem({
    reply,
    onReplyClick,
}: {
    reply: DiscordReplyData;
    onReplyClick: (postId: string) => void;
}) {
    const handleClick = useCallback(() => {
        onReplyClick(reply.post_id);
    }, [reply.post_id, onReplyClick]);

    const displayText = formatReplyPreview(reply);
    const avatarUrl = reply.user_id ? Client4.getProfilePictureUrl(reply.user_id, 0) : '';
    const initial = (reply.nickname || reply.username || '?')[0].toUpperCase();

    return (
        <div
            className='discord-reply-item'
            onClick={handleClick}
            role='button'
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && handleClick()}
        >
            {avatarUrl ? (
                <img
                    className='discord-reply-avatar'
                    src={avatarUrl}
                    alt={reply.username}
                    onError={(e) => {
                        // Replace with initial on error
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.insertAdjacentHTML(
                            'afterend',
                            `<div class="discord-reply-avatar discord-reply-avatar-fallback">${initial}</div>`,
                        );
                    }}
                />
            ) : (
                <div className='discord-reply-avatar discord-reply-avatar-fallback'>
                    {initial}
                </div>
            )}
            <span className='discord-reply-username'>
                {reply.nickname || reply.username}:
            </span>
            <span className='discord-reply-text'>
                {displayText}
            </span>
        </div>
    );
}

const DiscordReplyPreview = ({post}: Props) => {
    const history = useHistory();
    const currentTeamId = useSelector(getCurrentTeamId);
    const team = useSelector((state: GlobalState) => getTeam(state, currentTeamId));
    const config = useSelector(getConfig);

    // Get discord_replies from post props
    const replies = (post.props?.discord_replies || []) as DiscordReplyData[];

    // Check if feature is enabled
    const isEnabled = config?.FeatureFlagDiscordReplies === 'true';

    // Don't render if no replies or feature disabled
    if (!isEnabled || replies.length === 0) {
        return null;
    }

    const handleReplyClick = useCallback((postId: string) => {
        // Navigate to the original post
        const teamName = team?.name || 'default';
        const permalink = `/${teamName}/pl/${postId}`;
        history.push(permalink);
    }, [history, team?.name]);

    const replyCount = replies.length;

    // Determine connector positions
    const getConnectorPosition = (index: number): 'single' | 'first' | 'middle' | 'last' => {
        if (replyCount === 1) {
            return 'single';
        }
        if (index === 0) {
            return 'first';
        }
        if (index === replyCount - 1) {
            return 'last';
        }
        return 'middle';
    };

    return (
        <div className='discord-reply-preview'>
            <div className='discord-reply-content'>
                <div className='discord-reply-img'>
                    <div className='discord-reply-connectors'>
                        {replies.map((reply, index) => (
                            <div
                                key={`connector-${reply.post_id}-${index}`}
                                className={`discord-reply-connector connector-${getConnectorPosition(index)}`}
                            >
                                <ConnectorSVG position={getConnectorPosition(index)} />
                            </div>
                        ))}
                    </div>
                </div>
                <div className='discord-reply-body'>
                    {replies.map((reply, index) => (
                        <ReplyItem
                            key={`reply-${reply.post_id}-${index}`}
                            reply={reply}
                            onReplyClick={handleReplyClick}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default memo(DiscordReplyPreview);
