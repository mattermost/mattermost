// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostAttachmentList from './post_attachment_list.jsx';
import PostAttachmentOpenGraph from './post_attachment_opengraph.jsx';
import PostImage from './post_image.jsx';
import YoutubeVideo from 'components/youtube_video.jsx';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';

export default class PostBodyAdditionalContent extends React.Component {
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

    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextProps.post, this.props.post)) {
            return true;
        }
        if (!Utils.areObjectsEqual(nextProps.message, this.props.message)) {
            return true;
        }
        if (nextState.embedVisible !== this.state.embedVisible) {
            return true;
        }
        if (nextState.linkLoadError !== this.state.linkLoadError) {
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
                    childComponentDidUpdateFunction={this.props.childComponentDidUpdateFunction}
                    previewCollapsed={this.props.previewCollapsed}
                />
            );
        }

        return null;
    }

    render() {
        if (this.isLinkToggleable() && !this.state.linkLoadError) {
            const messageWithToggle = [];

            // if message has only one line and starts with a link place toggle in this only line
            // else - place it in new line between message and embed
            const prependToggle = (/^\s*https?:\/\/.*$/).test(this.props.post.message);
            messageWithToggle.push(
                <a
                    className={`post__embed-visibility ${prependToggle ? 'pull-left' : ''}`}
                    data-expanded={this.state.embedVisible}
                    aria-label='Toggle Embed Visibility'
                    onClick={this.toggleEmbedVisibility}
                />
            );

            if (prependToggle) {
                messageWithToggle.push(this.props.message);
            } else {
                messageWithToggle.unshift(this.props.message);
            }

            let toggleableEmbed;
            if (this.state.embedVisible) {
                toggleableEmbed = (
                    <div
                        className='post__embed-container'
                    >
                        {this.generateToggleableEmbed()}
                    </div>
                );
            }

            return (
                <div>
                    {messageWithToggle}
                    {toggleableEmbed}
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

PostBodyAdditionalContent.defaultProps = {
    previewCollapsed: 'false'
};
PostBodyAdditionalContent.propTypes = {
    post: React.PropTypes.object.isRequired,
    message: React.PropTypes.element.isRequired,
    compactDisplay: React.PropTypes.bool,
    previewCollapsed: React.PropTypes.string,
    childComponentDidUpdateFunction: React.PropTypes.func
};
