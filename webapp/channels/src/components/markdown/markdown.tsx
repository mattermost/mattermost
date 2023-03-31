// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Team} from '@mattermost/types/teams';
import {PostImage, PostType} from '@mattermost/types/posts';

import messageHtmlToComponent from 'utils/message_html_to_component';
import EmojiMap from 'utils/emoji_map';
import {ChannelNamesMap, TextFormattingOptions, formatText, MentionKey} from 'utils/text_formatting';
import PostEditedIndicator from '../post_view/post_edited_indicator';

type Props = {

    /*
     * An object mapping channel names to channels for the current team
     */
    channelNamesMap?: ChannelNamesMap;

    /*
     * An array of URL schemes that should be turned into links. Anything that looks
     * like a link will be turned into a link if this is not provided.
     */
    autolinkedUrlSchemes?: string[];

    /*
     * Whether or not to do Markdown rendering
     */
    enableFormatting?: boolean;

    /*
     * Whether or not this text is part of the RHS
     */
    isRHS?: boolean;

    /*
     * An array of paths on the server that are managed by another server
     */
    managedResourcePaths?: string[];

    /*
     * An array of words that can be used to mention a user
     */
    mentionKeys?: MentionKey[];

    /*
     * The text to be rendered
     */
    message: string;

    /*
     * Any additional text formatting options to be used
     */
    options: Partial<TextFormattingOptions>;

    /*
     * The root Site URL for the page
     */
    siteURL?: string;

    /*
     * The current team
     */
    team?: Team;

    /**
     * If an image proxy is enabled.
     */
    hasImageProxy?: boolean;

    /**
     * Minimum number of characters in a hashtag.
     */
    minimumHashtagLength?: number;

    /**
     * Whether or not to proxy image URLs
     */
    proxyImages?: boolean;

    /**
     * Any extra props that should be passed into the image component
     */
    imageProps?: object;

    /**
     * prop for passed down to image component for dimensions
     */
    imagesMetadata?: Record<string, PostImage>;

    /**
     * Whether or not to place the LinkTooltip component inside links
     */
    hasPluginTooltips?: boolean;

    /**
     * Post id prop passed down to markdown image
     */
    postId?: string;

    /**
     * When the post is edited this is the timestamp it happened at
     */
    editedAt?: number;

    channelId?: string;

    /**
     * Post id prop passed down to markdown image
     */
    postType?: PostType;
    emojiMap: EmojiMap;

    /**
     * Some components processed by messageHtmlToComponent e.g. AtSumOfMembersMention require to have a list of userIds
     */
    userIds?: string[];

    /**
     * Some additional data to pass down to rendered component to aid in rendering decisions
     */
    messageMetadata?: Record<string, string>;
}

export default class Markdown extends React.PureComponent<Props> {
    static defaultProps: Partial<Props> = {
        options: {},
        isRHS: false,
        proxyImages: true,
        imagesMetadata: {},
        postId: '', // Needed to avoid proptypes console errors for cases like channel header, which doesn't have a proper value
        editedAt: 0,
    }

    render() {
        const {postId, editedAt, message, enableFormatting} = this.props;
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

        const options = Object.assign({
            autolinkedUrlSchemes: this.props.autolinkedUrlSchemes,
            siteURL: this.props.siteURL,
            mentionKeys: this.props.mentionKeys,
            atMentions: true,
            channelNamesMap: this.props.channelNamesMap,
            proxyImages: this.props.hasImageProxy && this.props.proxyImages,
            team: this.props.team,
            minimumHashtagLength: this.props.minimumHashtagLength,
            managedResourcePaths: this.props.managedResourcePaths,
            editedAt,
            postId,
        }, this.props.options);

        const htmlFormattedText = formatText(message, options, this.props.emojiMap);

        return messageHtmlToComponent(htmlFormattedText, this.props.isRHS, {
            imageProps: this.props.imageProps,
            imagesMetadata: this.props.imagesMetadata,
            hasPluginTooltips: this.props.hasPluginTooltips,
            postId: this.props.postId,
            userIds: this.props.userIds,
            messageMetadata: this.props.messageMetadata,
            channelId: this.props.channelId,
            postType: this.props.postType,
            mentionHighlight: this.props.options.mentionHighlight,
            disableGroupHighlight: this.props.options.disableGroupHighlight,
            editedAt,
            atSumOfMembersMentions: this.props.options.atSumOfMembersMentions,
            atPlanMentions: this.props.options.atPlanMentions,
        });
    }
}
