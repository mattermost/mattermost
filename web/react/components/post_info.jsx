// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import DeletePostModal from './delete_post_modal.jsx';
import UserStore from '../stores/user_store.jsx';
import * as utils from '../utils/utils.jsx';
import TimeSince from './time_since.jsx';

import Constants from '../utils/constants.jsx';

export default class PostInfo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    createDropdown() {
        var post = this.props.post;
        var isOwner = UserStore.getCurrentId() === post.user_id;
        var isAdmin = utils.isAdmin(UserStore.getCurrentUser().roles);

        if (post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING || post.state === Constants.POST_DELETED) {
            return '';
        }

        var type = 'Post';
        if (post.root_id && post.root_id.length > 0) {
            type = 'Comment';
        }

        var dropdownContents = [];
        var dataComments = 0;
        if (type === 'Post') {
            dataComments = this.props.commentCount;
        }

        if (isOwner) {
            dropdownContents.push(
                <li
                    key='editPost'
                    role='presentation'
                >
                    <a
                        href='#'
                        role='menuitem'
                        data-toggle='modal'
                        data-target='#edit_post'
                        data-refocusid='#post_textbox'
                        data-title={type}
                        data-message={post.message}
                        data-postid={post.id}
                        data-channelid={post.channel_id}
                        data-comments={dataComments}
                    >
                        {'Edit'}
                    </a>
                </li>
            );
        }

        if (isOwner || isAdmin) {
            dropdownContents.push(
                <li
                    key='deletePost'
                    role='presentation'
                >
                    <a
                        href='#'
                        role='menuitem'
                        onClick={() => DeletePostModal.show(post, dataComments)}
                    >
                        {'Delete'}
                    </a>
                </li>
            );
        }

        if (this.props.allowReply === 'true') {
            dropdownContents.push(
                <li
                    key='replyLink'
                    role='presentation'
                >
                    <a
                        className='link__reply theme'
                        href='#'
                        onClick={this.props.handleCommentClick}
                    >
                        {'Reply'}
                    </a>
                </li>
            );
        }

        if (dropdownContents.length === 0) {
            return '';
        }

        return (
            <div>
                <a
                    href='#'
                    className='dropdown-toggle post__dropdown theme'
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
        var comments = '';
        var showCommentClass = '';
        var commentCountText = this.props.commentCount;

        if (this.props.commentCount >= 1) {
            showCommentClass = ' icon--show';
        } else {
            commentCountText = '';
        }

        if (post.state !== Constants.POST_FAILED && post.state !== Constants.POST_LOADING && post.state !== Constants.POST_DELETED) {
            comments = (
                <a
                    href='#'
                    className={'comment-icon__container' + showCommentClass}
                    onClick={this.props.handleCommentClick}
                >
                    <span
                        className='comment-icon'
                        dangerouslySetInnerHTML={{__html: Constants.COMMENT_ICON}}
                    />
                    {commentCountText}
                </a>
            );
        }

        var dropdown = this.createDropdown();

        return (
            <ul className='post__header post__header--info'>
                <li className='col'>
                    <TimeSince
                        eventTime={post.create_at}
                    />
                </li>
                <li className='col col__reply'>
                    {comments}
                    <div className='dropdown'>
                        {dropdown}
                    </div>
                </li>
            </ul>
        );
    }
}

PostInfo.defaultProps = {
    post: null,
    commentCount: 0,
    isLastComment: false,
    allowReply: false
};
PostInfo.propTypes = {
    post: React.PropTypes.object,
    commentCount: React.PropTypes.number,
    isLastComment: React.PropTypes.bool,
    allowReply: React.PropTypes.string,
    handleCommentClick: React.PropTypes.func
};
