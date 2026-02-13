// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {ActionTypes, Preferences} from 'utils/constants';
import {isVideoUrl} from 'components/video_link_embed';

import type {ThunkActionFunc} from 'types/store';
import type {DiscordReplyData} from 'reducers/views/discord_replies';

import {getPendingReplies} from 'selectors/views/discord_replies';

// Constants
const MAX_REPLIES = 10;
const MAX_PREVIEW_LENGTH = 100;

/**
 * Checks if a post has image attachments.
 */
function hasImageAttachment(post: {metadata?: {files?: Array<{mime_type: string}>}}): boolean {
    const files = post.metadata?.files || [];
    return files.some((f) => f.mime_type?.startsWith('image/'));
}

/**
 * Checks if a post has video attachments.
 */
function hasVideoAttachment(post: {metadata?: {files?: Array<{mime_type: string}>}}): boolean {
    const files = post.metadata?.files || [];
    return files.some((f) => f.mime_type?.startsWith('video/'));
}

/**
 * Maps a MIME type to a file category for emoji display.
 */
function getFileCategory(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
        return 'image';
    }
    if (mimeType.startsWith('video/')) {
        return 'video';
    }
    if (mimeType.startsWith('audio/')) {
        return 'audio';
    }
    if (mimeType === 'application/pdf' ||
        mimeType.startsWith('application/msword') ||
        mimeType.startsWith('application/vnd.openxmlformats-officedocument') ||
        mimeType.startsWith('application/vnd.oasis.opendocument') ||
        mimeType === 'application/rtf') {
        return 'document';
    }
    if (mimeType === 'application/zip' ||
        mimeType === 'application/x-tar' ||
        mimeType === 'application/gzip' ||
        mimeType === 'application/x-7z-compressed' ||
        mimeType === 'application/x-rar-compressed' ||
        mimeType === 'application/vnd.rar') {
        return 'archive';
    }
    if (mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/xml' ||
        mimeType === 'application/javascript' ||
        mimeType === 'application/typescript') {
        return 'code';
    }
    return 'file';
}

/**
 * Gets deduplicated file categories from a post's attachments and embedded media.
 */
function getFileCategories(post: {metadata?: {
    files?: Array<{mime_type: string}>;
    embeds?: Array<{type: string; url: string}>;
    images?: Record<string, {format: string; frameCount?: number}>;
}}, videoLinkEmbedEnabled: boolean): string[] {
    const categories = new Set<string>();

    // 1. File attachments
    const files = post.metadata?.files || [];
    for (const f of files) {
        if (f.mime_type) {
            categories.add(getFileCategory(f.mime_type));
        }
    }

    // 2. Embedded content from links
    const embeds = post.metadata?.embeds || [];
    for (const embed of embeds) {
        if (embed.type === 'image') {
            categories.add('image');
        } else if (embed.type === 'opengraph' || embed.type === 'link') {
            // Check if the link URL points to a video
            if (videoLinkEmbedEnabled && embed.url && isVideoUrl(embed.url)) {
                categories.add('video');
            }
        }
    }

    // 3. Images metadata (includes inline images and gifs from links)
    const images = post.metadata?.images || {};
    for (const url of Object.keys(images)) {
        const img = images[url];
        if (img.format === 'gif' && img.frameCount && img.frameCount > 1) {
            categories.add('gif');
        } else if (img.format) {
            categories.add('image');
        }
    }

    return Array.from(categories);
}

/**
 * Strips quote lines from a message.
 */
function stripQuotes(message: string): string {
    const lines = message.split('\n');
    const nonQuoteLines = lines.filter((line) => !line.trim().startsWith('>'));
    return nonQuoteLines.join('\n').trim();
}

/**
 * Truncates text to a maximum length.
 */
function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Action creator to add a pending reply.
 */
function addPendingReplyAction(reply: DiscordReplyData, channelId?: string) {
    return {
        type: ActionTypes.DISCORD_REPLY_ADD_PENDING,
        reply,
        channelId,
    };
}

/**
 * Action creator to remove a pending reply.
 */
export function removePendingReply(postId: string): ThunkActionFunc<void> {
    return (dispatch, getState) => {
        const state = getState();
        const channelSpecific = get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_SPECIFIC_REPLIES, Preferences.CHANNEL_SPECIFIC_REPLIES_DEFAULT) === 'true';
        const channelId = channelSpecific ? getCurrentChannelId(state) : undefined;
        dispatch({
            type: ActionTypes.DISCORD_REPLY_REMOVE_PENDING,
            postId,
            channelId,
        });
    };
}

/**
 * Action creator to clear all pending replies.
 */
export function clearPendingReplies(): ThunkActionFunc<void> {
    return (dispatch, getState) => {
        const state = getState();
        const channelSpecific = get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_SPECIFIC_REPLIES, Preferences.CHANNEL_SPECIFIC_REPLIES_DEFAULT) === 'true';
        const channelId = channelSpecific ? getCurrentChannelId(state) : undefined;
        dispatch({
            type: ActionTypes.DISCORD_REPLY_CLEAR_PENDING,
            channelId,
        });
    };
}

/**
 * Action creator to clear all pending replies across all channels.
 */
export function clearAllPendingReplies() {
    return {
        type: ActionTypes.DISCORD_REPLY_CLEAR_PENDING,
        clearAll: true,
    };
}

/**
 * Adds a post to the pending replies queue.
 * If the post is already in the queue, it will be removed (toggle behavior).
 * Returns true if the post was added or removed successfully.
 */
export function addPendingReply(postId: string): ThunkActionFunc<boolean> {
    return (dispatch, getState) => {
        const state = getState();

        // Check if at max capacity
        const pendingReplies = getPendingReplies(state);
        const existingIndex = pendingReplies.findIndex((r) => r.post_id === postId);

        // If at max and not removing, reject
        if (pendingReplies.length >= MAX_REPLIES && existingIndex < 0) {
            return false;
        }

        // Get post data
        const post = getPost(state, postId);
        if (!post) {
            console.error('[DiscordReplies] Post not found:', postId);
            return false;
        }

        // Get user data
        const user = getUser(state, post.user_id);
        if (!user) {
            console.error('[DiscordReplies] User not found:', post.user_id);
            return false;
        }

        // Check for media attachments
        const hasImage = hasImageAttachment(post);
        const hasVideo = hasVideoAttachment(post);
        const config = getConfig(state);
        const videoLinkEmbedEnabled = config?.FeatureFlagVideoLinkEmbed === 'true';
        const fileCategories = getFileCategories(post, videoLinkEmbedEnabled);

        // Clean text - strip quotes, take first line only, and truncate
        const strippedText = stripQuotes(post.message);
        const firstLine = strippedText.split('\n')[0] || '';
        const cleanText = truncateText(firstLine, MAX_PREVIEW_LENGTH);

        const channelSpecific = get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_SPECIFIC_REPLIES, Preferences.CHANNEL_SPECIFIC_REPLIES_DEFAULT) === 'true';
        const channelId = channelSpecific ? getCurrentChannelId(state) : undefined;

        const replyData: DiscordReplyData = {
            post_id: postId,
            user_id: post.user_id,
            username: user.username,
            nickname: user.nickname || user.first_name || user.username,
            text: cleanText,
            has_image: hasImage,
            has_video: hasVideo,
            file_categories: fileCategories,
        };

        dispatch(addPendingReplyAction(replyData, channelId));
        return true;
    };
}

/**
 * Gets the permalink URL for a post.
 */
export function getPostPermalink(state: ReturnType<ThunkActionFunc<unknown, unknown>>['getState'] extends () => infer S ? S : never, postId: string): string {
    const post = getPost(state, postId);
    if (!post) {
        return '';
    }

    const {currentTeamId} = state.entities.teams;
    const team = state.entities.teams.teams[currentTeamId];
    const teamName = team?.name || 'default';

    // Get the site URL from config
    const siteUrl = state.entities.general?.config?.SiteURL || window.location.origin;

    return `${siteUrl}/${teamName}/pl/${postId}`;
}

/**
 * Generates the quote text for all pending replies.
 * Format: >[@username](permalink): content
 */
export function generateQuoteText(): ThunkActionFunc<string> {
    return (_dispatch, getState) => {
        const state = getState();
        const pendingReplies = getPendingReplies(state);

        if (pendingReplies.length === 0) {
            return '';
        }

        const quoteLines: string[] = [];

        for (const reply of pendingReplies) {
            const permalink = getPostPermalink(state, reply.post_id);

            // Format file type emojis
            const emojiMap: Record<string, string> = {
                image: '🖼️',
                gif: '🎞️',
                video: '🎥',
                audio: '🎵',
                document: '📄',
                archive: '📦',
                code: '💻',
                file: '📎',
            };
            const fileEmojis = (reply.file_categories || []).map((cat) => emojiMap[cat] || '📎').join(' ');
            let content = '';
            if (fileEmojis && reply.text) {
                content = `${fileEmojis} ${reply.text}`;
            } else if (fileEmojis) {
                content = fileEmojis;
            } else {
                content = reply.text;
            }

            quoteLines.push(`>[@${reply.username}](${permalink}): ${content}`);
        }

        return quoteLines.join('\n') + '\n\n';
    };
}
