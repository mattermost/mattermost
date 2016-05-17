// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostAttachmentList from './post_attachment_list.jsx';
import PostAttachmentOEmbed from './post_attachment_oembed.jsx';
import PostImage from './post_image.jsx';
import YoutubeVideo from 'components/youtube_video.jsx';

import Constants from 'utils/constants.jsx';
import OEmbedProviders from './providers.json';
import * as Utils from 'utils/utils.jsx';

import React from 'react';

export default class PostBodyAdditionalContent extends React.Component {
    constructor(props) {
        super(props);

        this.getSlackAttachment = this.getSlackAttachment.bind(this);
        this.getOEmbedProvider = this.getOEmbedProvider.bind(this);
        this.generateEmbed = this.generateEmbed.bind(this);
        this.toggleEmbedVisibility = this.toggleEmbedVisibility.bind(this);

        this.state = {
            embedVisible: true
        };
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextProps.post, this.props.post)) {
            return true;
        }
        if (nextState.embedVisible !== this.state.embedVisible) {
            return true;
        }
        return false;
    }

    toggleEmbedVisibility() {
        this.setState({embedVisible: !this.state.embedVisible});
    }

    getSlackAttachment() {
        let attachments = [];
        if (this.props.post.props && this.props.post.props.attachments) {
            attachments = this.props.post.props.attachments;
        }

        return (
            <PostAttachmentList
                attachments={attachments}
            />
        );
    }

    getOEmbedProvider(link) {
        for (let i = 0; i < OEmbedProviders.length; i++) {
            for (let j = 0; j < OEmbedProviders[i].patterns.length; j++) {
                if (link.match(OEmbedProviders[i].patterns[j])) {
                    return OEmbedProviders[i];
                }
            }
        }

        return null;
    }

    generateEmbed() {
        if (this.props.post.type === 'slack_attachment') {
            return this.getSlackAttachment();
        }

        const link = Utils.extractFirstLink(this.props.post.message);
        if (!link) {
            return null;
        }

        if (Utils.isFeatureEnabled(Constants.PRE_RELEASE_FEATURES.EMBED_PREVIEW)) {
            const provider = this.getOEmbedProvider(link);

            if (provider) {
                return (
                    <PostAttachmentOEmbed
                        provider={provider}
                        link={link}
                    />
                );
            }
        }

        if (YoutubeVideo.isYoutubeLink(link)) {
            return (
                <YoutubeVideo
                    channelId={this.props.post.channel_id}
                    link={link}
                />
            );
        }

        for (let i = 0; i < Constants.IMAGE_TYPES.length; i++) {
            const imageType = Constants.IMAGE_TYPES[i];
            const suffix = link.substring(link.length - (imageType.length + 1));
            if (suffix === '.' + imageType || suffix === '=' + imageType) {
                return (
                    <PostImage
                        channelId={this.props.post.channel_id}
                        link={link}
                    />
                );
            }
        }

        return null;
    }

    render() {
        const generateEmbed = this.generateEmbed();

        if (generateEmbed) {
            let toggle;
            if (Utils.isFeatureEnabled(Constants.PRE_RELEASE_FEATURES.EMBED_TOGGLE)) {
                toggle = (
                    <a
                        className='post__embed-visibility'
                        data-expanded={this.state.embedVisible}
                        aria-label='Toggle Embed Visibility'
                        onClick={this.toggleEmbedVisibility}
                    />
                );
            }

            return (
                <div>
                    {toggle}
                    <div
                        className='post__embed-container'
                        hidden={!this.state.embedVisible}
                    >
                    {generateEmbed}
                    </div>
                </div>
            );
        }

        return null;
    }
}

PostBodyAdditionalContent.propTypes = {
    post: React.PropTypes.object.isRequired
};
