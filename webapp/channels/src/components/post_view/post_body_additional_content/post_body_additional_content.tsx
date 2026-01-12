// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isAppBinding, type AppBinding} from '@mattermost/types/apps';
import {isMessageAttachmentArray} from '@mattermost/types/message_attachments';
import type {Post, PostEmbed} from '@mattermost/types/posts';
import {isArrayOf} from '@mattermost/types/utilities';

import {validateBindings} from 'mattermost-redux/utils/apps';
import {getEmbedFromMetadata} from 'mattermost-redux/utils/post_utils';

import MessageAttachmentList from 'components/post_view/message_attachments/message_attachment_list';
import PostAttachmentOpenGraph from 'components/post_view/post_attachment_opengraph';
import PostImage from 'components/post_view/post_image';
import PostMessagePreview from 'components/post_view/post_message_preview';
import YoutubeVideo from 'components/youtube_video';

import webSocketClient from 'client/web_websocket_client';
import type {TextFormattingOptions} from 'utils/text_formatting';

import type {PostWillRenderEmbedComponent} from 'types/store/plugins';

import EmbeddedBindings from '../embedded_bindings/embedded_bindings';

export type Props = {
    post: Post;
    pluginPostWillRenderEmbedComponents?: PostWillRenderEmbedComponent[];
    children?: JSX.Element;
    isEmbedVisible?: boolean;
    options?: Partial<TextFormattingOptions>;
    appsEnabled: boolean;
    handleFileDropdownOpened?: (open: boolean) => void;
    actions: {
        toggleEmbedVisibility: (id: string) => void;
    };
};

export default class PostBodyAdditionalContent extends React.PureComponent<Props> {
    toggleEmbedVisibility = () => {
        this.props.actions.toggleEmbedVisibility(this.props.post.id);
    };

    getEmbed = () => {
        const {metadata} = this.props.post;
        return getEmbedFromMetadata(metadata);
    };

    isEmbedToggleable = (embed: PostEmbed) => {
        const postWillRenderEmbedComponents = this.props.pluginPostWillRenderEmbedComponents || [];
        for (const c of postWillRenderEmbedComponents) {
            if (c.match(embed)) {
                return Boolean(c.toggleable);
            }
        }

        return embed.type === 'image' || (embed.type === 'opengraph' && YoutubeVideo.isYoutubeLink(embed.url));
    };

    renderEmbed = (embed: PostEmbed) => {
        const postWillRenderEmbedComponents = this.props.pluginPostWillRenderEmbedComponents || [];
        for (const c of postWillRenderEmbedComponents) {
            if (c.match(embed)) {
                const Component = c.component;
                return this.props.isEmbedVisible && (
                    <Component
                        embed={embed}
                        webSocketClient={webSocketClient}
                    />
                );
            }
        }
        switch (embed.type) {
        case 'image':
            if (!this.props.isEmbedVisible) {
                return null;
            }

            return (
                <PostImage
                    imageMetadata={this.props.post.metadata.images[embed.url]}
                    link={embed.url}
                    post={this.props.post}
                />
            );

        case 'message_attachment': {
            const attachments = isMessageAttachmentArray(this.props.post.props?.attachments) ? this.props.post.props?.attachments : [];

            return (
                <MessageAttachmentList
                    attachments={attachments}
                    postId={this.props.post.id}
                    options={this.props.options}
                    imagesMetadata={this.props.post.metadata.images}
                />
            );
        }

        case 'opengraph':
            if (YoutubeVideo.isYoutubeLink(embed.url)) {
                if (!this.props.isEmbedVisible) {
                    return null;
                }

                return (
                    <YoutubeVideo
                        postId={this.props.post.id}
                        link={embed.url}
                        show={this.props.isEmbedVisible}
                    />
                );
            }

            return (
                <PostAttachmentOpenGraph
                    postId={this.props.post.id}
                    link={embed.url}
                    isEmbedVisible={this.props.isEmbedVisible}
                    post={this.props.post}
                    toggleEmbedVisibility={this.toggleEmbedVisibility}
                />
            );
        case 'permalink':
            if (embed.data && 'post_id' in embed.data && embed.data.post_id) {
                return (
                    <PostMessagePreview
                        metadata={embed.data}
                        handleFileDropdownOpened={this.props.handleFileDropdownOpened}
                    />
                );
            }
            return null;
        default:
            return null;
        }
    };

    renderToggle = (prependToggle: boolean) => {
        return (
            <button
                key='toggle'
                className={`style--none post__embed-visibility color--link ${prependToggle ? 'pull-left' : ''}`}
                data-expanded={this.props.isEmbedVisible}
                aria-label='Toggle Embed Visibility'
                onClick={this.toggleEmbedVisibility}
            />
        );
    };

    render() {
        const embed = this.getEmbed();

        if (this.props.appsEnabled) {
            const appEmbeds = isArrayOf<AppBinding>(this.props.post.props?.app_bindings, isAppBinding) ? validateBindings(this.props.post.props?.app_bindings) : [];
            if (appEmbeds.length) {
                // TODO Put some log / message if the form is not valid?
                return (
                    <>
                        {this.props.children}
                        <EmbeddedBindings
                            embeds={appEmbeds}
                            post={this.props.post}
                        />
                    </>
                );
            }
        }

        if (embed) {
            const toggleable = this.isEmbedToggleable(embed);
            const prependToggle = (/^\s*https?:\/\/.*$/).test(this.props.post.message);

            return (
                <div>
                    {(toggleable && prependToggle) && this.renderToggle(true)}
                    {this.props.children}
                    {(toggleable && !prependToggle) && this.renderToggle(false)}
                    {this.renderEmbed(embed)}
                </div>
            );
        }

        return this.props.children;
    }
}
