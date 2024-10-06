// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import memoize from 'memoize-one';
import React from 'react';

import type {Post} from '@mattermost/types/posts';

import {Posts} from 'mattermost-redux/constants';

import Markdown from 'components/markdown';

import type {TextFormattingOptions} from 'utils/text_formatting';

import {renderReminderSystemBotMessage, renderSystemMessage, renderWranglerSystemMessage} from './system_message_helpers';

import {type PropsFromRedux} from './index';

export type OwnProps = {

    /**
     * Any extra props that should be passed into the image component
     */
    imageProps?: Record<string, unknown>;

    /**
     * The post text to be rendered
     */
    message: string;

    /**
     * The optional post for which this message is being rendered
     */
    post?: Post;
    channelId: string;

    /**
     * Whether or not to render the post edited indicator
     * @default true
     */
    showPostEditedIndicator?: boolean;
    options?: TextFormattingOptions;
};

type Props = PropsFromRedux & OwnProps;

export default class PostMarkdown extends React.PureComponent<Props> {
    static defaultProps = {
        pluginHooks: [],
        options: {},
        showPostEditedIndicator: true,
    };

    getOptions = memoize(
        (options?: TextFormattingOptions, disableGroupHighlight?: boolean, mentionHighlight?: boolean, editedAt?: number) => {
            return {
                ...options,
                disableGroupHighlight,
                mentionHighlight,
                editedAt,
            };
        });

    render() {
        let message = this.props.message;

        if (this.props.post) {
            const renderedSystemMessage = this.props.channel ? renderSystemMessage(this.props.post,
                this.props.currentTeam?.name ?? '',
                this.props.channel,
                this.props.hideGuestTags,
                this.props.isUserCanManageMembers,
                this.props.isMilitaryTime,
                this.props.timezone) : null;
            if (renderedSystemMessage) {
                return <div>{renderedSystemMessage}</div>;
            }
        }

        if (this.props.post && this.props.post.type === Posts.POST_TYPES.REMINDER) {
            if (!this.props.currentTeam) {
                return null;
            }
            const renderedSystemBotMessage = renderReminderSystemBotMessage(this.props.post, this.props.currentTeam);
            return <div>{renderedSystemBotMessage}</div>;
        }

        if (this.props.post && this.props.post.type === Posts.POST_TYPES.WRANGLER) {
            const renderedWranglerMessage = renderWranglerSystemMessage(this.props.post);
            return <div>{renderedWranglerMessage}</div>;
        }

        // Proxy images if we have an image proxy and the server hasn't already rewritten the this.props.post's image URLs.
        const proxyImages = !this.props.post || !this.props.post.message_source || this.props.post.message === this.props.post.message_source;
        const channelNamesMap = this.props.post && this.props.post.props && this.props.post.props.channel_mentions;

        this.props.pluginHooks?.forEach((o) => {
            if (o && o.hook && this.props.post) {
                message = o.hook(this.props.post, message);
            }
        });

        let mentionHighlight = this.props.options?.mentionHighlight;
        if (this.props.post && this.props.post.props) {
            mentionHighlight = !this.props.post.props.mentionHighlightDisabled;
        }

        const options = this.getOptions(
            this.props.options,
            this.props.post?.props?.disable_group_highlight === true,
            mentionHighlight,
            this.props.post?.edit_at,
        );

        let highlightKeys;
        if (!this.props.isEnterpriseOrCloudOrSKUStarterFree && this.props.isEnterpriseReady) {
            highlightKeys = this.props.highlightKeys;
        }

        return (
            <Markdown
                imageProps={this.props.imageProps}
                message={message}
                proxyImages={proxyImages}
                mentionKeys={this.props.mentionKeys}
                highlightKeys={highlightKeys}
                options={options}
                channelNamesMap={channelNamesMap}
                hasPluginTooltips={this.props.hasPluginTooltips}
                imagesMetadata={this.props.post?.metadata?.images}
                postId={this.props.post?.id}
                editedAt={this.props.showPostEditedIndicator ? this.props.post?.edit_at : undefined}
            />
        );
    }
}
