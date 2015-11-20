// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FileAttachmentList from './file_attachment_list.jsx';
import UserStore from '../stores/user_store.jsx';
import * as Utils from '../utils/utils.jsx';
import Constants from '../utils/constants.jsx';
import * as TextFormatting from '../utils/text_formatting.jsx';
import twemoji from 'twemoji';
import PostBodyAdditionalContent from './post_body_additional_content.jsx';

import providers from './providers.json';

export default class PostBody extends React.Component {
    constructor(props) {
        super(props);

        this.receivedYoutubeData = false;
        this.isImgLoading = false;

        this.handleUserChange = this.handleUserChange.bind(this);
        this.parseEmojis = this.parseEmojis.bind(this);
        this.createEmbed = this.createEmbed.bind(this);
        this.createImageEmbed = this.createImageEmbed.bind(this);
        this.loadImg = this.loadImg.bind(this);
        this.createYoutubeEmbed = this.createYoutubeEmbed.bind(this);

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
        twemoji.parse(ReactDOM.findDOMNode(this), {size: Constants.EMOJI_SIZE});
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

        if (this.checkForOembedContent(trimmedLink)) {
            post.props.oEmbedLink = trimmedLink;
            post.type = 'oEmbed';
            this.setState({post});
            return '';
        }

        const embed = this.createYoutubeEmbed(link);

        if (embed != null) {
            return embed;
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

    checkForOembedContent(link) {
        for (let i = 0; i < providers.length; i++) {
            for (let j = 0; j < providers[i].patterns.length; j++) {
                if (link.match(providers[i].patterns[j])) {
                    return true;
                }
            }
        }
        return false;
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

    handleYoutubeTime(link) {
        const timeRegex = /[\\?&]t=([0-9hms]+)/;

        const time = link.match(timeRegex);
        if (!time || !time[1]) {
            return '';
        }

        const hours = time[1].match(/([0-9]+)h/);
        const minutes = time[1].match(/([0-9]+)m/);
        const seconds = time[1].match(/([0-9]+)s/);

        let ticks = 0;

        if (hours && hours[1]) {
            ticks += parseInt(hours[1], 10) * 3600;
        }

        if (minutes && minutes[1]) {
            ticks += parseInt(minutes[1], 10) * 60;
        }

        if (seconds && seconds[1]) {
            ticks += parseInt(seconds[1], 10);
        }

        return '&start=' + ticks.toString();
    }

    createYoutubeEmbed(link) {
        const ytRegex = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|watch\?(?:[a-zA-Z-_]+=[a-zA-Z0-9-_]+&)+v=)([^#\&\?]*).*/;

        const match = link.trim().match(ytRegex);
        if (!match || match[1].length !== 11) {
            return null;
        }

        const youtubeId = match[1];
        const time = this.handleYoutubeTime(link);

        function onClick(e) {
            var div = $(e.target).closest('.video-thumbnail__container')[0];
            var iframe = document.createElement('iframe');
            iframe.setAttribute('src',
                                'https://www.youtube.com/embed/' +
                                div.id +
                                '?autoplay=1&autohide=1&border=0&wmode=opaque&fs=1&enablejsapi=1' +
                                time);
            iframe.setAttribute('width', '480px');
            iframe.setAttribute('height', '360px');
            iframe.setAttribute('type', 'text/html');
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allowfullscreen', 'allowfullscreen');

            div.parentNode.replaceChild(iframe, div);
        }

        function success(data) {
            if (!data.items.length || !data.items[0].snippet) {
                return null;
            }
            var metadata = data.items[0].snippet;
            this.receivedYoutubeData = true;
            this.setState({youtubeTitle: metadata.title});
        }

        if (global.window.mm_config.GoogleDeveloperKey && !this.receivedYoutubeData) {
            $.ajax({
                async: true,
                url: 'https://www.googleapis.com/youtube/v3/videos',
                type: 'GET',
                data: {part: 'snippet', id: youtubeId, key: global.window.mm_config.GoogleDeveloperKey},
                success: success.bind(this)
            });
        }

        let header = 'Youtube';
        if (this.state.youtubeTitle) {
            header = header + ' - ';
        }

        return (
            <div>
                <h4>
                    <span className='video-type'>{header}</span>
                    <span className='video-title'><a href={link}>{this.state.youtubeTitle}</a></span>
                </h4>
                <div
                    className='video-div embed-responsive-item'
                    id={youtubeId}
                    onClick={onClick}
                >
                    <div className='embed-responsive embed-responsive-4by3 video-div__placeholder'>
                        <div
                            id={youtubeId}
                            className='video-thumbnail__container'
                        >
                            <img
                                className='video-thumbnail'
                                src={'https://i.ytimg.com/vi/' + youtubeId + '/hqdefault.jpg'}
                            />
                            <div className='block'>
                                <span className='play-button'><span/></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    render() {
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
                if (profile.username.slice(-1) === 's') {
                    apostrophe = '\'';
                } else {
                    apostrophe = '\'s';
                }
                name = (
                    <a
                        className='theme'
                        onClick={Utils.searchForTerm.bind(null, profile.username)}
                    >
                        {profile.username}
                    </a>
                );
            }

            let message = '';
            if (parentPost.message) {
                message = Utils.replaceHtmlEntities(parentPost.message);
            } else if (parentPost.filenames.length) {
                message = parentPost.filenames[0].split('/').pop();

                if (parentPost.filenames.length === 2) {
                    message += ' plus 1 other file';
                } else if (parentPost.filenames.length > 2) {
                    message += ` plus ${parentPost.filenames.length - 1} other files`;
                }
            }

            comment = (
                <div className='post__link'>
                    <span>
                        {'Commented on '}{name}{apostrophe}{' message: '}
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
                    {'Retry'}
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
                    />
                    {fileAttachmentHolder}
                    {this.embed}
                </div>
            </div>
        );
    }
}

PostBody.propTypes = {
    post: React.PropTypes.object.isRequired,
    parentPost: React.PropTypes.object,
    retryPost: React.PropTypes.func.isRequired,
    handleCommentClick: React.PropTypes.func.isRequired
};
