// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const FileAttachmentList = require('./file_attachment_list.jsx');
const UserStore = require('../stores/user_store.jsx');
const Utils = require('../utils/utils.jsx');
const Constants = require('../utils/constants.jsx');
const TextFormatting = require('../utils/text_formatting.jsx');
const twemoji = require('twemoji');

export default class PostBody extends React.Component {
    constructor(props) {
        super(props);

        this.parseEmojis = this.parseEmojis.bind(this);

        const linkData = Utils.extractLinks(this.props.post.message);
        this.state = {links: linkData.links, message: linkData.text};
    }
    parseEmojis() {
        twemoji.parse(React.findDOMNode(this), {size: Constants.EMOJI_SIZE});
    }
    componentDidMount() {
        this.parseEmojis();
    }
    componentDidUpdate() {
        this.parseEmojis();
    }
    componentWillReceiveProps(nextProps) {
        const linkData = Utils.extractLinks(nextProps.post.message);
        this.setState({links: linkData.links, message: linkData.text});
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
                <p className='post-link'>
                    <span>
                        Commented on {name}{apostrophe} message:
                        <a
                            className='theme'
                            onClick={this.props.handleCommentClick}
                        >
                            {message}
                        </a>
                    </span>
                </p>
            );

            postClass += ' post-comment';
        }

        let loading;
        if (post.state === Constants.POST_FAILED) {
            postClass += ' post-fail';
            loading = (
                <a
                    className='theme post-retry pull-right'
                    href='#'
                    onClick={this.props.retryPost}
                >
                    Retry
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

        let embed;
        if (filenames.length === 0 && this.state.links) {
            embed = Utils.getEmbed(this.state.links[0]);
        }

        let fileAttachmentHolder = '';
        if (filenames && filenames.length > 0) {
            fileAttachmentHolder = (
                <FileAttachmentList
                    filenames={filenames}
                    modalId={`view_image_modal_${post.id}`}
                    channelId={post.channel_id}
                    userId={post.user_id}
                />
            );
        }

        return (
            <div className='post-body'>
                {comment}
                <p
                    key={`${post.id}_message`}
                    className={postClass}
                >
                    {loading}
                    <span
                        onClick={TextFormatting.handleClick}
                        dangerouslySetInnerHTML={{__html: TextFormatting.formatText(this.state.message)}}
                    />
                </p>
                {fileAttachmentHolder}
                {embed}
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
