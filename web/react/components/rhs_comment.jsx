// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var PostStore = require('../stores/post_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var UserProfile = require('./user_profile.jsx');
var UserStore = require('../stores/user_store.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Utils = require('../utils/utils.jsx');
var Constants = require('../utils/constants.jsx');
var FileAttachmentList = require('./file_attachment_list.jsx');
var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var ActionTypes = Constants.ActionTypes;
var TextFormatting = require('../utils/text_formatting.jsx');
var twemoji = require('twemoji');

export default class RhsComment extends React.Component {
    constructor(props) {
        super(props);

        this.retryComment = this.retryComment.bind(this);
        this.parseEmojis = this.parseEmojis.bind(this);

        this.state = {};
    }
    retryComment(e) {
        e.preventDefault();

        var post = this.props.post;
        Client.createPost(post, post.channel_id,
            (data) => {
                AsyncClient.getPosts(post.channel_id);

                var channel = ChannelStore.get(post.channel_id);
                var member = ChannelStore.getMember(post.channel_id);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = (new Date()).getTime();
                ChannelStore.setChannelMember(member);

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_POST,
                    post: data
                });
            },
            () => {
                post.state = Constants.POST_FAILED;
                PostStore.updatePendingPost(post);
                this.forceUpdate();
            }
        );

        post.state = Constants.POST_LOADING;
        PostStore.updatePendingPost(post);
        this.forceUpdate();
    }
    parseEmojis() {
        twemoji.parse(ReactDOM.findDOMNode(this), {size: Constants.EMOJI_SIZE});
    }
    componentDidMount() {
        this.parseEmojis();
    }
    shouldComponentUpdate(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.post, this.props.post)) {
            return true;
        }

        return false;
    }
    componentDidUpdate() {
        this.parseEmojis();
    }
    createDropdown() {
        var post = this.props.post;

        if (post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING || post.state === Constants.POST_DELETED) {
            return '';
        }

        var isOwner = UserStore.getCurrentId() === post.user_id;
        var isAdmin = Utils.isAdmin(UserStore.getCurrentUser().roles);

        var dropdownContents = [];

        if (isOwner) {
            dropdownContents.push(
                <li
                    role='presentation'
                    key='edit-button'
                >
                    <a
                        href='#'
                        role='menuitem'
                        data-toggle='modal'
                        data-target='#edit_post'
                        data-refocusid='#reply_textbox'
                        data-title='Comment'
                        data-message={post.message}
                        data-postid={post.id}
                        data-channelid={post.channel_id}
                    >
                        {'Edit'}
                    </a>
                </li>
            );
        }

        if (isOwner || isAdmin) {
            dropdownContents.push(
                <li
                    role='presentation'
                    key='delete-button'
                >
                    <a
                        href='#'
                        role='menuitem'
                        data-toggle='modal'
                        data-target='#delete_post'
                        data-title='Comment'
                        data-postid={post.id}
                        data-channelid={post.channel_id}
                        data-comments={0}
                    >
                        {'Delete'}
                    </a>
                </li>
            );
        }

        if (dropdownContents.length === 0) {
            return '';
        }

        return (
            <div className='dropdown'>
                <a
                    href='#'
                    className='dropdown-toggle theme'
                    type='button'
                    data-toggle='dropdown'
                    aria-expanded='false'
                />
                <ul
                    className='dropdown-menu'
                    role='menu'
                >
                    {dropdownContents}
                </ul>
            </div>
            );
    }
    render() {
        var post = this.props.post;

        var currentUserCss = '';
        if (UserStore.getCurrentId() === post.user_id) {
            currentUserCss = 'current--user';
        }

        var timestamp = UserStore.getCurrentUser().update_at;

        var loading;
        var postClass = '';
        if (post.state === Constants.POST_FAILED) {
            postClass += ' post-fail';
            loading = (
                <a
                    className='theme post-retry pull-right'
                    href='#'
                    onClick={this.retryComment}
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

        var dropdown = this.createDropdown();

        var fileAttachment;
        if (post.filenames && post.filenames.length > 0) {
            fileAttachment = (
                <FileAttachmentList
                    filenames={post.filenames}
                    channelId={post.channel_id}
                    userId={post.user_id}
                />
            );
        }

        return (
            <div className={'post ' + currentUserCss}>
                <div className='post-profile-img__container'>
                    <img
                        className='post-profile-img'
                        src={'/api/v1/users/' + post.user_id + '/image?time=' + timestamp + '&' + Utils.getSessionIndex()}
                        height='36'
                        width='36'
                    />
                </div>
                <div className='post__content'>
                    <ul className='post-header'>
                        <li className='post-header-col'>
                            <strong><UserProfile userId={post.user_id} /></strong>
                        </li>
                        <li className='post-header-col'>
                            <time className='post-profile-time'>
                                {Utils.displayCommentDateTime(post.create_at)}
                            </time>
                        </li>
                        <li className='post-header-col post-header__reply'>
                            {dropdown}
                        </li>
                    </ul>
                    <div className='post-body'>
                        <div className={postClass}>
                            {loading}
                            <div
                                ref='message_holder'
                                onClick={TextFormatting.handleClick}
                                dangerouslySetInnerHTML={{__html: TextFormatting.formatText(post.message)}}
                            />
                        </div>
                        {fileAttachment}
                    </div>
                </div>
            </div>
        );
    }
}

RhsComment.defaultProps = {
    post: null
};
RhsComment.propTypes = {
    post: React.PropTypes.object
};
