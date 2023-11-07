// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PostImage, PostType} from '@mattermost/types/posts';

import type {HighlightWithoutNotificationKey} from 'mattermost-redux/selectors/entities/users';

import PostEditedIndicator from 'components/post_view/post_edited_indicator';

import messageHtmlToComponent from 'utils/message_html_to_component';
import type {ChannelNamesMap, MentionKey, TextFormattingOptions} from 'utils/text_formatting';
import {formatText} from 'utils/text_formatting';

import {type PropsFromRedux} from './index';

export type OwnProps = {
    channelNamesMap?: ChannelNamesMap;
    mentionKeys?: MentionKey[];
    highlightKeys?: HighlightWithoutNotificationKey[];
    postId?: string;

    /*
     * Any additional text formatting options to be used
     */
    options?: Partial<TextFormattingOptions>;

    /**
     * Whether or not to proxy image URLs
     */
    proxyImages?: boolean;

    /**
     * prop for passed down to image component for dimensions
     */
    imagesMetadata?: Record<string, PostImage>;

    /**
     * Any extra props that should be passed into the image component
     */
    imageProps?: object;

    /**
     * Whether or not to place the LinkTooltip component inside links
     */
    hasPluginTooltips?: boolean;

    /**
     * Post id prop passed down to markdown image
     */
    postType?: PostType;

    /**
     * Some components processed by messageHtmlToComponent e.g. AtSumOfMembersMention require to have a list of userIds
     */
    userIds?: string[];

    /**
     * When the post is edited this is the timestamp it happened at
     */
    editedAt?: number;

    /**
     * Some additional data to pass down to rendered component to aid in rendering decisions
     */
    messageMetadata?: Record<string, string>;

    /*
     * The text to be rendered
     */
    message?: string;
}

type Props = PropsFromRedux & OwnProps;

export default class Markdown extends React.PureComponent<Props> {
    static defaultProps: Partial<Props> = {
        options: {},
        proxyImages: true,
        imagesMetadata: {},
        postId: '', // Needed to avoid proptypes console errors for cases like channel header, which doesn't have a proper value
        editedAt: 0,
    };

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
            highlightKeys: this.props.highlightKeys,
            atMentions: true,
            channelNamesMap: this.props.channelNamesMap,
            proxyImages: this.props.hasImageProxy && this.props.proxyImages,
            team: this.props.team,
            minimumHashtagLength: this.props.minimumHashtagLength,
            managedResourcePaths: this.props.managedResourcePaths,
            editedAt,
            postId,
        }, this.props.options);

        const htmlFormattedText = formatText(message || '', options, this.props.emojiMap);

        return messageHtmlToComponent(htmlFormattedText, {
            imageProps: this.props.imageProps,
            imagesMetadata: this.props.imagesMetadata,
            hasPluginTooltips: this.props.hasPluginTooltips,
            postId: this.props.postId,
            userIds: this.props.userIds,
            messageMetadata: this.props.messageMetadata,
            channelId: this.props.channelId,
            postType: this.props.postType,
            mentionHighlight: this.props?.options?.mentionHighlight,
            disableGroupHighlight: this.props?.options?.disableGroupHighlight,
            editedAt,
            atSumOfMembersMentions: this.props?.options?.atSumOfMembersMentions,
            atPlanMentions: this.props?.options?.atPlanMentions,
        });
    }
}
