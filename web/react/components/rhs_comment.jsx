// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
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

export default class RhsComment extends React.Component {
    constructor(props) {
        super(props);

        this.retryComment = this.retryComment.bind(this);

        this.state = {};
    }
    retryComment(e) {
        e.preventDefault();

        var post = this.props.post;
        Client.createPost(post, post.channel_id,
            function success(data) {
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
            function fail() {
                post.state = Constants.POST_FAILED;
                PostStore.updatePendingPost(post);
                this.forceUpdate();
            }.bind(this)
        );

        post.state = Constants.POST_LOADING;
        PostStore.updatePendingPost(post);
        this.forceUpdate();
    }
    shouldComponentUpdate(nextProps) {
        if (!Utils.areStatesEqual(nextProps.post, this.props.post)) {
            return true;
        }

        return false;
    }
    render() {
        var post = this.props.post;

        var currentUserCss = '';
        if (UserStore.getCurrentId() === post.user_id) {
            currentUserCss = 'current--user';
        }

        var isOwner = UserStore.getCurrentId() === post.user_id;

        var type = 'Post';
        if (post.root_id.length > 0) {
            type = 'Comment';
        }

        var message = Utils.textToJsx(post.message);
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

        var ownerOptions;
        if (isOwner && post.state !== Constants.POST_FAILED && post.state !== Constants.POST_LOADING) {
            ownerOptions = (
                <div
                    className='dropdown'
                    onClick={
                        function scroll() {
                            $('.post-list-holder-by-time').scrollTop($('.post-list-holder-by-time').scrollTop() + 50);
                        }
                    }
                >
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
                        <li role='presentation'>
                            <a
                                href='#'
                                role='menuitem'
                                data-toggle='modal'
                                data-target='#edit_post'
                                data-title={type}
                                data-message={post.message}
                                data-postid={post.id}
                                data-channelid={post.channel_id}
                            >
                                Edit
                            </a>
                        </li>
                        <li role='presentation'>
                            <a
                                href='#'
                                role='menuitem'
                                data-toggle='modal'
                                data-target='#delete_post'
                                data-title={type}
                                data-postid={post.id}
                                data-channelid={post.channel_id}
                                data-comments={0}
                            >
                                Delete
                            </a>
                        </li>
                    </ul>
                </div>
            );
        }

        var fileAttachment;
        if (post.filenames && post.filenames.length > 0) {
            fileAttachment = (
                <FileAttachmentList
                    filenames={post.filenames}
                    modalId={'rhs_comment_view_image_modal_' + post.id}
                    channelId={post.channel_id}
                    userId={post.user_id} />
            );
        }

        return (
            <div className={'post ' + currentUserCss}>
                <div className='post-profile-img__container'>
                    <img
                        className='post-profile-img'
                        src={'/api/v1/users/' + post.user_id + '/image?time=' + timestamp}
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
                            <time className='post-right-comment-time'>
                                {Utils.displayCommentDateTime(post.create_at)}
                            </time>
                        </li>
                        <li className='post-header-col post-header__reply'>
                            {ownerOptions}
                        </li>
                    </ul>
                    <div className='post-body'>
                        <p className={postClass}>{loading}{message}</p>
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
