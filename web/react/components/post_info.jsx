// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var utils = require('../utils/utils.jsx');

var Constants = require('../utils/constants.jsx');
var Tooltip = ReactBootstrap.Tooltip;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;

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
                        Edit
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
                        data-toggle='modal'
                        data-target='#delete_post'
                        data-title={type}
                        data-postid={post.id}
                        data-channelid={post.channel_id}
                        data-comments={dataComments}
                    >
                        Delete
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
                        className='reply-link theme'
                        href='#'
                        onClick={this.props.handleCommentClick}
                    >
                        Reply
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
        var comments = '';
        var lastCommentClass = ' comment-icon__container__hide';
        if (this.props.isLastComment) {
            lastCommentClass = ' comment-icon__container__show';
        }

        if (this.props.commentCount >= 1 && post.state !== Constants.POST_FAILED && post.state !== Constants.POST_LOADING && post.state !== Constants.POST_DELETED) {
            comments = (
                <a
                    href='#'
                    className={'comment-icon__container theme' + lastCommentClass}
                    onClick={this.props.handleCommentClick}
                >
                    <span
                        className='comment-icon'
                        dangerouslySetInnerHTML={{__html: Constants.COMMENT_ICON}}
                    />
                    {this.props.commentCount}
                </a>
            );
        }

        var dropdown = this.createDropdown();

        let tooltip = <Tooltip id={post.id + 'tooltip'}>{`${utils.displayDate(post.create_at)} at ${utils.displayTime(post.create_at)}`}</Tooltip>;

        return (
            <ul className='post-header post-info'>
                <li className='post-header-col'>
                    <OverlayTrigger
                        delayShow={500}
                        container={this}
                        placement='top'
                        overlay={tooltip}
                    >
                        <time className='post-profile-time'>
                            {utils.displayDateTime(post.create_at)}
                        </time>
                    </OverlayTrigger>
                </li>
                <li className='post-header-col post-header__reply'>
                    <div className='dropdown'>
                        {dropdown}
                    </div>
                    {comments}
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
