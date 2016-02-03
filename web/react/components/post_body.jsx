// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FileAttachmentList from './file_attachment_list.jsx';
import UserStore from '../stores/user_store.jsx';
import * as Utils from '../utils/utils.jsx';
import * as Emoji from '../utils/emoticons.jsx';
import Constants from '../utils/constants.jsx';
const PreReleaseFeatures = Constants.PRE_RELEASE_FEATURES;
import * as TextFormatting from '../utils/text_formatting.jsx';
import twemoji from 'twemoji';
import PostBodyAdditionalContent from './post_body_additional_content.jsx';
import YoutubeVideo from './youtube_video.jsx';

import providers from './providers.json';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    plusOne: {
        id: 'post_body.plusOne',
        defaultMessage: ' plus 1 other file'
    },
    plusMore: {
        id: 'post_body.plusMore',
        defaultMessage: ' plus {count} other files'
    }
});

class PostBody extends React.Component {
    constructor(props) {
        super(props);

        this.isImgLoading = false;

        this.handleUserChange = this.handleUserChange.bind(this);
        this.parseEmojis = this.parseEmojis.bind(this);
        this.createEmbed = this.createEmbed.bind(this);
        this.createImageEmbed = this.createImageEmbed.bind(this);
        this.loadImg = this.loadImg.bind(this);

        const linkData = Utils.extractLinks(this.props.post.message);
        const profiles = UserStore.getProfiles();

        this.state = {
            links: linkData.links,
            message: linkData.text,
            post: this.props.post,
            hasUserProfiles: profiles && Object.keys(profiles).length > 1
        };
    }

    getAllChildNodes(nodeIn) {
        var textNodes = [];

        function getTextNodes(node) {
            textNodes.push(node);

            for (var i = 0, len = node.childNodes.length; i < len; ++i) {
                getTextNodes(node.childNodes[i]);
            }
        }

        getTextNodes(nodeIn);
        return textNodes;
    }

    parseEmojis() {
        twemoji.parse(ReactDOM.findDOMNode(this), {
            className: 'emoji twemoji',
            base: '',
            folder: Emoji.getImagePathForEmoticon()
        });
    }

    componentWillMount() {
        if (this.props.post.filenames.length === 0 && this.state.links && this.state.links.length > 0) {
            this.embed = this.createEmbed(this.state.links[0]);
        }
    }

    componentDidMount() {
        this.parseEmojis();

        UserStore.addChangeListener(this.handleUserChange);
    }

    componentDidUpdate() {
        this.parseEmojis();
    }

    componentWillUnmount() {
        UserStore.removeChangeListener(this.handleUserChange);
    }

    handleUserChange() {
        if (!this.state.hasProfiles) {
            const profiles = UserStore.getProfiles();

            this.setState({hasProfiles: profiles && Object.keys(profiles).length > 1});
        }
    }

    componentWillReceiveProps(nextProps) {
        const linkData = Utils.extractLinks(nextProps.post.message);
        if (this.props.post.filenames.length === 0 && this.state.links && this.state.links.length > 0) {
            this.embed = this.createEmbed(linkData.links[0]);
        }
        this.setState({links: linkData.links, message: linkData.text});
    }

    createEmbed(link) {
        const post = this.state.post;

        if (!link) {
            if (post.type === 'oEmbed') {
                post.props.oEmbedLink = '';
                post.type = '';
            }
            return null;
        }

        const trimmedLink = link.trim();

        if (Utils.isFeatureEnabled(PreReleaseFeatures.EMBED_PREVIEW)) {
            const provider = this.getOembedProvider(trimmedLink);
            if (provider != null) {
                post.props.oEmbedLink = trimmedLink;
                post.type = 'oEmbed';
                this.setState({post, provider});
                return '';
            }
        }

        if (YoutubeVideo.isYoutubeLink(link)) {
            return (
                <YoutubeVideo
                    channelId={post.channel_id}
                    link={link}
                />
            );
        }

        for (let i = 0; i < Constants.IMAGE_TYPES.length; i++) {
            const imageType = Constants.IMAGE_TYPES[i];
            const suffix = link.substring(link.length - (imageType.length + 1));
            if (suffix === '.' + imageType || suffix === '=' + imageType) {
                return this.createImageEmbed(link, this.state.imgLoaded);
            }
        }

        return null;
    }

    getOembedProvider(link) {
        for (let i = 0; i < providers.length; i++) {
            for (let j = 0; j < providers[i].patterns.length; j++) {
                if (link.match(providers[i].patterns[j])) {
                    return providers[i];
                }
            }
        }
        return null;
    }

    loadImg(src) {
        if (this.isImgLoading) {
            return;
        }

        this.isImgLoading = true;

        const img = new Image();
        img.onload = (
            () => {
                this.embed = this.createImageEmbed(src, true);
                this.setState({imgLoaded: true});
            }
        );
        img.src = src;
    }

    createImageEmbed(link, isLoaded) {
        if (!isLoaded) {
            this.loadImg(link);
            return (
                <img
                    className='img-div placeholder'
                    height='500px'
                />
            );
        }

        return (
            <img
                className='img-div'
                src={link}
            />
        );
    }

    render() {
        const {formatMessage} = this.props.intl;
        const post = this.props.post;
        const filenames = this.props.post.filenames;
        const parentPost = this.props.parentPost;

        let comment = '';
        let postClass = '';

        if (parentPost) {
            const profile = UserStore.getProfile(parentPost.user_id);

            let apostrophe = '';
            let name = '...';
            if (profile != null) {
                let username = profile.username;
                if (parentPost.props &&
                        parentPost.props.from_webhook &&
                        parentPost.props.override_username &&
                        global.window.mm_config.EnablePostUsernameOverride === 'true') {
                    username = parentPost.props.override_username;
                }

                if (global.window.mm_locale === 'en') {
                    if (username.slice(-1) === 's') {
                        apostrophe = '\'';
                    } else {
                        apostrophe = '\'s';
                    }
                }
                name = (
                    <a
                        className='theme'
                        onClick={Utils.searchForTerm.bind(null, username)}
                    >
                        {username}
                    </a>
                );
            }

            let message = '';
            if (parentPost.message) {
                message = Utils.replaceHtmlEntities(parentPost.message);
            } else if (parentPost.filenames.length) {
                message = parentPost.filenames[0].split('/').pop();

                if (parentPost.filenames.length === 2) {
                    message += formatMessage(holders.plusOne);
                } else if (parentPost.filenames.length > 2) {
                    message += formatMessage(holders.plusMore, {count: (parentPost.filenames.length - 1)});
                }
            }

            comment = (
                <div className='post__link'>
                    <span>
                        <FormattedMessage
                            id='post_body.commentedOn'
                            defaultMessage='Commented on {name}{apostrophe} message: '
                            values={{
                                name: (name),
                                apostrophe: apostrophe
                            }}
                        />
                        <a
                            className='theme'
                            onClick={this.props.handleCommentClick}
                        >
                            {message}
                        </a>
                    </span>
                </div>
            );
        }

        let loading;
        if (post.state === Constants.POST_FAILED) {
            postClass += ' post--fail';
            loading = (
                <a
                    className='theme post-retry pull-right'
                    href='#'
                    onClick={this.props.retryPost}
                >
                    <FormattedMessage
                        id='post_body.retry'
                        defaultMessage='Retry'
                    />
                </a>
            );
        } else if (post.state === Constants.POST_LOADING) {
            postClass += ' post-waiting';
            loading = (
                <img
                    className='post-loading-gif pull-right'
                    src='/static/images/load.gif'
                />
            );
        }

        let fileAttachmentHolder = '';
        if (filenames && filenames.length > 0) {
            fileAttachmentHolder = (
                <FileAttachmentList
                    filenames={filenames}
                    channelId={post.channel_id}
                    userId={post.user_id}
                />
            );
        }

        return (
            <div>
                {comment}
                <div className='post__body'>
                    <div
                        key={`${post.id}_message`}
                        id={`${post.id}_message`}
                        className={postClass}
                    >
                        {loading}
                        <span
                            ref='message_span'
                            onClick={TextFormatting.handleClick}
                            dangerouslySetInnerHTML={{__html: TextFormatting.formatText(this.state.message)}}
                        />
                    </div>
                    <PostBodyAdditionalContent
                        post={this.state.post}
                        provider={this.state.provider}
                    />
                    {fileAttachmentHolder}
                    {this.embed}
                </div>
            </div>
        );
    }
}

PostBody.propTypes = {
    intl: intlShape.isRequired,
    post: React.PropTypes.object.isRequired,
    parentPost: React.PropTypes.object,
    retryPost: React.PropTypes.func.isRequired,
    handleCommentClick: React.PropTypes.func.isRequired
};

export default injectIntl(PostBody);