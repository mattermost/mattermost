// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostAttachmentList from './post_attachment_list.jsx';
import PostAttachmentOpenGraph from './post_attachment_opengraph';
import PostImage from './post_image.jsx';
import YoutubeVideo from 'components/youtube_video';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';
import PropTypes from 'prop-types';

export default class PostBodyAdditionalContent extends React.PureComponent {
    static propTypes = {

        /**
         * The post to render the content of
         */
        post: PropTypes.object.isRequired,

        /**
         * The post's message
         */
        message: PropTypes.element.isRequired,

        /**
         * Set to collapse image and video previews
         */
        previewCollapsed: PropTypes.string
    }

    static defaultProps = {
        previewCollapsed: ''
    }

    constructor(props) {
        super(props);

        this.getSlackAttachment = this.getSlackAttachment.bind(this);
        this.generateToggleableEmbed = this.generateToggleableEmbed.bind(this);
        this.generateStaticEmbed = this.generateStaticEmbed.bind(this);
        this.toggleEmbedVisibility = this.toggleEmbedVisibility.bind(this);
        this.isLinkToggleable = this.isLinkToggleable.bind(this);
        this.handleLinkLoadError = this.handleLinkLoadError.bind(this);

        this.state = {
            embedVisible: props.previewCollapsed.startsWith('false'),
            link: Utils.extractFirstLink(props.post.message),
            linkLoadError: false
        };
    }

    componentWillReceiveProps(nextProps) {
        this.setState({
            embedVisible: nextProps.previewCollapsed.startsWith('false'),
            link: Utils.extractFirstLink(nextProps.post.message),
            linkLoadError: false
        });
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

    isLinkImage(link) {
        const regex = /.+\/(.+\.(?:jpg|gif|bmp|png|jpeg))(?:\?.*)?$/i;
        const match = link.match(regex);
        if (match && match[1]) {
            return true;
        }

        return false;
    }

    isLinkToggleable() {
        const link = this.state.link;
        if (!link) {
            return false;
        }

        if (YoutubeVideo.isYoutubeLink(link)) {
            return true;
        }

        if (this.isLinkImage(link)) {
            return true;
        }

        return false;
    }

    handleLinkLoadError() {
        this.setState({
            linkLoadError: true
        });
    }

    generateToggleableEmbed() {
        const link = this.state.link;
        if (!link) {
            return null;
        }

        if (YoutubeVideo.isYoutubeLink(link)) {
            return (
                <YoutubeVideo
                    channelId={this.props.post.channel_id}
                    link={link}
                    show={this.state.embedVisible}
                />
            );
        }

        if (this.isLinkImage(link)) {
            return (
                <PostImage
                    channelId={this.props.post.channel_id}
                    link={link}
                    onLinkLoadError={this.handleLinkLoadError}
                />
            );
        }

        return null;
    }

    generateStaticEmbed() {
        if (this.props.post.props && this.props.post.props.attachments) {
            return this.getSlackAttachment();
        }

        const link = Utils.extractFirstLink(this.props.post.message);
        if (link && Utils.isFeatureEnabled(Constants.PRE_RELEASE_FEATURES.EMBED_PREVIEW)) {
            return (
                <PostAttachmentOpenGraph
                    link={link}
                    previewCollapsed={this.props.previewCollapsed}
                />
            );
        }

        return null;
    }

    render() {
        if (this.isLinkToggleable() && !this.state.linkLoadError) {
            // if message has only one line and starts with a link place toggle in this only line
            // else - place it in new line between message and embed
            const prependToggle = (/^\s*https?:\/\/.*$/).test(this.props.post.message);

            const toggle = (
                <a
                    key='toggle'
                    className={`post__embed-visibility ${prependToggle ? 'pull-left' : ''}`}
                    data-expanded={this.state.embedVisible}
                    aria-label='Toggle Embed Visibility'
                    onClick={this.toggleEmbedVisibility}
                />
            );
            const message = (
                <div key='message'>
                    {this.props.message}
                </div>
            );

            let contents;
            if (prependToggle) {
                contents = [toggle, message];
            } else {
                contents = [message, toggle];
            }

            if (this.state.embedVisible) {
                contents.push(
                    <div
                        key='embed'
                        className='post__embed-container'
                    >
                        {this.generateToggleableEmbed()}
                    </div>
                );
            }

            return (
                <div>
                    {contents}
                </div>
            );
        }

        const staticEmbed = this.generateStaticEmbed();

        if (staticEmbed) {
            return (
                <div>
                    {this.props.message}
                    {staticEmbed}
                </div>
            );
        }

        return this.props.message;
    }
}
