// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var UserProfile = require('./user_profile.jsx');
var UserStore = require('../stores/user_store.jsx');
var TextFormatting = require('../utils/text_formatting.jsx');
var utils = require('../utils/utils.jsx');
var FileAttachmentList = require('./file_attachment_list.jsx');
var twemoji = require('twemoji');
var Constants = require('../utils/constants.jsx');

export default class RhsRootPost extends React.Component {
    constructor(props) {
        super(props);

        this.parseEmojis = this.parseEmojis.bind(this);

        this.state = {};
    }
    parseEmojis() {
        twemoji.parse(React.findDOMNode(this), {size: Constants.EMOJI_SIZE});
    }
    componentDidMount() {
        this.parseEmojis();
    }
    shouldComponentUpdate(nextProps) {
        if (!utils.areStatesEqual(nextProps.post, this.props.post)) {
            return true;
        }

        return false;
    }
    componentDidUpdate() {
        this.parseEmojis();
    }
    render() {
        var post = this.props.post;
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
                channelName = 'Direct Message';
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
                    channelId={post.channel_id}
                    userId={post.user_id}
                />
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
                        <li className='post-header-col'>
                            <time className='post-profile-time'>
                                {utils.displayCommentDateTime(post.create_at)}
                            </time>
                        </li>
                        <li className='post-header-col post-header__reply'>
                            <div className='dropdown'>
                                {ownerOptions}
                            </div>
                        </li>
                    </ul>
                    <div className='post-body'>
                        <div
                            ref='message_holder'
                            onClick={TextFormatting.handleClick}
                            dangerouslySetInnerHTML={{__html: TextFormatting.formatText(post.message)}}
                        />
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
