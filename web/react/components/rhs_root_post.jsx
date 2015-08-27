// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var UserProfile = require('./user_profile.jsx');
var UserStore = require('../stores/user_store.jsx');
var utils = require('../utils/utils.jsx');
var FileAttachmentList = require('./file_attachment_list.jsx');

export default class RhsRootPost extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    shouldComponentUpdate(nextProps) {
        if (!utils.areStatesEqual(nextProps.post, this.props.post)) {
            return true;
        }

        return false;
    }
    render() {
        var post = this.props.post;
        var message = utils.textToJsx(post.message);
        var isOwner = UserStore.getCurrentId() === post.user_id;
        var timestamp = UserStore.getProfile(post.user_id).update_at;
        var channel = ChannelStore.get(post.channel_id);

        var type = 'Post';
        if (post.root_id.length > 0) {
            type = 'Comment';
        }

        var currentUserCss = '';
        if (UserStore.getCurrentId() === post.user_id) {
            currentUserCss = 'current--user';
        }

        var channelName;
        if (channel) {
            if (channel.type === 'D') {
                channelName = 'Private Message';
            } else {
                channelName = channel.display_name;
            }
        }

        var ownerOptions;
        if (isOwner) {
            ownerOptions = (
                <div>
                    <a href='#'
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
                                data-comments={this.props.commentCount}
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
                    modalId={'rhs_view_image_modal_' + post.id}
                    channelId={post.channel_id}
                    userId={post.user_id} />
            );
        }

        return (
            <div className={'post post--root ' + currentUserCss}>
                <div className='post-right-channel__name'>{channelName}</div>
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
                        <li className='post-header-col'><strong><UserProfile userId={post.user_id} /></strong></li>
                        <li className='post-header-col'><time className='post-right-root-time'>{utils.displayCommentDateTime(post.create_at)}</time></li>
                        <li className='post-header-col post-header__reply'>
                            <div className='dropdown'>
                                {ownerOptions}
                            </div>
                        </li>
                    </ul>
                    <div className='post-body'>
                        <p>{message}</p>
                        {fileAttachment}
                    </div>
                </div>
                <hr />
            </div>
        );
    }
}

RhsRootPost.defaultProps = {
    post: null,
    commentCount: 0
};
RhsRootPost.propTypes = {
    post: React.PropTypes.object,
    commentCount: React.PropTypes.number
};
