// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PostEditedIndicator from 'components/post_view/post_edited_indicator';

import messageHtmlToComponent from 'utils/message_html_to_component';
import {formatText} from 'utils/text_formatting';

import type {PropsFromRedux, OwnProps} from './index';

export type Props = PropsFromRedux & OwnProps;

function Markdown({
    options = {},
    proxyImages = true,
    imagesMetadata = {},
    postId = '', // Needed to avoid proptypes console errors for cases like channel header, which doesn't have a proper value
    editedAt = 0,
    message = '',
    enableFormatting,
    autolinkedUrlSchemes,
    siteURL,
    mentionKeys,
    channelNamesMap,
    hasImageProxy,
    team,
    minimumHashtagLength,
    managedResourcePaths,
    emojiMap,
    imageProps,
    hasPluginTooltips,
    userIds,
    messageMetadata,
    channelId,
    postType,
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
        autolinkedUrlSchemes,
        siteURL,
        mentionKeys,
        atMentions: true,
        channelNamesMap,
        proxyImages: hasImageProxy && proxyImages,
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
        userIds,
        messageMetadata,
        channelId,
        postType,
        mentionHighlight: options?.mentionHighlight,
        disableGroupHighlight: options?.disableGroupHighlight,
        editedAt,
        atSumOfMembersMentions: options?.atSumOfMembersMentions,
        atPlanMentions: options?.atPlanMentions,
    });
}

export default Markdown;
