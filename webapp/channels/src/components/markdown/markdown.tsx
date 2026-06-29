// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PostImage, PostType} from '@mattermost/types/posts';

import type {HighlightWithoutNotificationKey} from 'mattermost-redux/selectors/entities/users';

import PostEditedIndicator from 'components/post_view/post_edited_indicator';

import type EmojiMap from 'utils/emoji_map';
import messageHtmlToComponent from 'utils/message_html_to_component';
import type {ChannelNamesMap, MentionKey, TextFormattingOptions} from 'utils/text_formatting';
import {formatText} from 'utils/text_formatting';

import type {PropsFromRedux} from './index';

export type Props = PropsFromRedux & OwnProps;

export type OwnProps = {

    /**
     * Any additional text formatting options to be used
     */
    options?: Partial<TextFormattingOptions>;

    /**
     * prop for passed down to image component for dimensions
     */
    imagesMetadata?: Record<string, PostImage>;

    /**
     * Post id prop passed down to markdown image
     */
    postId?: string;

    /**
     * When the post is edited this is the timestamp it happened at
     */
    editedAt?: number;

    /*
     * The text to be rendered
     */
    message?: string;
    channelNamesMap?: ChannelNamesMap;

    /*
     * An array of words that can be used to mention a user
     */
    mentionKeys?: MentionKey[];
    highlightKeys?: HighlightWithoutNotificationKey[];

    /**
     * Any extra props that should be passed into the image component
     */
    imageProps?: object;

    /**
     * Whether or not to place the LinkTooltip component inside links
     */
    hasPluginTooltips?: boolean;

    channelId?: string;

    /**
     * Post id prop passed down to markdown image
     */
    postType?: PostType;
    emojiMap?: EmojiMap;

    /**
     * Whether or not to render mmaction:// links as inline action buttons.
     * Set per-post by the caller (e.g. enabled for bot/webhook/plugin posts).
     * Defaults to false.
     */
    allowInlineActions?: boolean;
};

function Markdown({
    options = {},
    imagesMetadata = {},
    postId = '', // Needed to avoid proptypes console errors for cases like channel header, which doesn't have a proper value
    editedAt = 0,
    message = '',
    channelNamesMap,
    mentionKeys,
    highlightKeys,
    imageProps,
    channelId,
    hasPluginTooltips,
    postType,
    emojiMap,
    allowInlineActions,
    enableFormatting,
    siteURL,
    team,
    minimumHashtagLength,
    managedResourcePaths,
}: Props) {
    if (message === '' || !enableFormatting) {
        return (
            <span>
                {message}
                <PostEditedIndicator
                    postId={postId}
                    editedAt={editedAt}
                />
            </span>
        );
    }

    const inputOptions = Object.assign({
        siteURL,
        mentionKeys,
        highlightKeys,
        atMentions: true,
        channelNamesMap,
        team,
        minimumHashtagLength,
        managedResourcePaths,
        editedAt,
        postId,
    }, options);

    const htmlFormattedText = formatText(message, inputOptions, emojiMap);

    return messageHtmlToComponent(htmlFormattedText, {
        imageProps,
        imagesMetadata,
        hasPluginTooltips,
        postId,
        channelId,
        postType,
        mentionHighlight: options?.mentionHighlight,
        disableGroupHighlight: options?.disableGroupHighlight,
        editedAt,
        allowInlineActions,
    });
}

export default Markdown;
