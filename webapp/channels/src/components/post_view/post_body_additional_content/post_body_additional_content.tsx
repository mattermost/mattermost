// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AppBinding} from '@mattermost/types/apps';
import {Post, PostEmbed} from '@mattermost/types/posts';
import React from 'react';

import {getEmbedFromMetadata} from 'mattermost-redux/utils/post_utils';

import MessageAttachmentList from 'components/post_view/message_attachments/message_attachment_list';
import PostAttachmentOpenGraph from 'components/post_view/post_attachment_opengraph';
import PostImage from 'components/post_view/post_image';
import PostMessagePreview from 'components/post_view/post_message_preview';
import YoutubeVideo from 'components/youtube_video';

import EmbeddedBindings from '../embedded_bindings/embedded_bindings';
import webSocketClient from 'client/web_websocket_client.jsx';
import {PostWillRenderEmbedPluginComponent} from 'types/store/plugins';
import {TextFormattingOptions} from 'utils/text_formatting';

export type Props = {
    post: Post;
    pluginPostWillRenderEmbedComponents?: PostWillRenderEmbedPluginComponent[];
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
            let attachments = [];
            if (this.props.post.props && this.props.post.props.attachments) {
                attachments = this.props.post.props.attachments;
            }

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
            if (hasValidEmbeddedBinding(this.props.post.props)) {
                // TODO Put some log / message if the form is not valid?
                return (
                    <React.Fragment>
                        {this.props.children}
                        <EmbeddedBindings
                            embeds={this.props.post.props.app_bindings}
                            post={this.props.post}
                        />
                    </React.Fragment>
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

function hasValidEmbeddedBinding(props: Record<string, any>) {
    if (!props) {
        return false;
    }

    if (!props.app_bindings) {
        return false;
    }

    const embeds = props.app_bindings as AppBinding[];

    if (!embeds.length) {
        return false;
    }

    return true;
}
