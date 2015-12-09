// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChannelStore from '../stores/channel_store.jsx';
import UserProfile from './user_profile.jsx';
import UserStore from '../stores/user_store.jsx';
import * as TextFormatting from '../utils/text_formatting.jsx';
import * as utils from '../utils/utils.jsx';
import * as Emoji from '../utils/emoticons.jsx';
import FileAttachmentList from './file_attachment_list.jsx';
import StarredItem from './starred_item.jsx';
import twemoji from 'twemoji';
import PostBodyAdditionalContent from './post_body_additional_content.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';

import Constants from '../utils/constants.jsx';

export default class RhsRootPost extends React.Component {
    constructor(props) {
        super(props);

        this.parseEmojis = this.parseEmojis.bind(this);

        this.state = {};
    }
    parseEmojis() {
        twemoji.parse(ReactDOM.findDOMNode(this), {
            className: 'emoji twemoji',
            base: '',
            folder: Emoji.getImagePathForEmoticon()
        });
    }
    componentDidMount() {
        this.parseEmojis();
    }
    shouldComponentUpdate(nextProps) {
        if (!utils.areObjectsEqual(nextProps.post, this.props.post)) {
            return true;
        }

        return false;
    }
    componentDidUpdate() {
        this.parseEmojis();
    }
    render() {
        var post = this.props.post;
        var currentUser = UserStore.getCurrentUser();
        var isOwner = currentUser.id === post.user_id;
        var isAdmin = utils.isAdmin(currentUser.roles);
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

        var systemMessageClass = '';
        if (utils.isSystemMessage(post)) {
            systemMessageClass = 'post--system';
        }

        var channelName;
        if (channel) {
            if (channel.type === 'D') {
                channelName = 'Direct Message';
            } else {
                channelName = channel.display_name;
            }
        }

        var dropdownContents = [];

        if (isOwner) {
            dropdownContents.push(
                <li
                    key='rhs-root-edit'
                    role='presentation'
                >
                    <a
                        href='#'
                        role='menuitem'
                        data-toggle='modal'
                        data-target='#edit_post'
                        data-refocusid='#reply_textbox'
                        data-title={type}
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
                    key='rhs-root-delete'
                    role='presentation'
                >
                    <a
                        href='#'
                        role='menuitem'
                        onClick={() => EventHelpers.showDeletePostModal(post, this.props.commentCount)}
                    >
                        {'Delete'}
                    </a>
                </li>
            );
        }

        var rootOptions = '';
        if (dropdownContents.length > 0) {
            rootOptions = (
                <div className='dropdown'>
                    <a
                        href='#'
                        className='post__dropdown dropdown-toggle'
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

        let userProfile = <UserProfile userId={post.user_id} />;
        let botIndicator;

        if (post.props && post.props.from_webhook) {
            if (post.props.override_username && global.window.mm_config.EnablePostUsernameOverride === 'true') {
                userProfile = (
                    <UserProfile
                        userId={post.user_id}
                        overwriteName={post.props.override_username}
                        disablePopover={true}
                    />
                );
            }

            botIndicator = <li className='col col__name bot-indicator'>{'BOT'}</li>;
        } else if (utils.isSystemMessage(post)) {
            userProfile = (
                <UserProfile
                    userId={''}
                    overwriteName={Constants.SYSTEM_MESSAGE_PROFILE_NAME}
                    overwriteImage={Constants.SYSTEM_MESSAGE_PROFILE_IMAGE}
                    disablePopover={true}
                />
            );
        }

        let src = '/api/v1/users/' + post.user_id + '/image?time=' + timestamp + '&' + utils.getSessionIndex();
        if (post.props && post.props.from_webhook && global.window.mm_config.EnablePostIconOverride === 'true') {
            if (post.props.override_icon_url) {
                src = post.props.override_icon_url;
            }
        } else if (utils.isSystemMessage(post)) {
            src = Constants.SYSTEM_MESSAGE_PROFILE_IMAGE;
        }

        const profilePic = (
            <img
                className='post-profile-img'
                src={src}
                height='36'
                width='36'
            />
        );

        return (
            <div className={'post post--root ' + currentUserCss + ' ' + systemMessageClass}>
                <div className='post-right-channel__name'>{channelName}</div>
                <div className='post__content'>
                    <div className='post__img'>
                        {profilePic}
                    </div>
                    <div>
                        <ul className='post__header'>
                            <li className='col__name'>{userProfile}</li>
                            {botIndicator}
                            <li className='col'>
                                <time className='post__time'>
                                    {utils.displayCommentDateTime(post.create_at)}
                                </time>
                            </li>
                            <li>
                                <StarredItem
                                    id={post.id}
                                    type={Constants.Preferences.STARRED_POSTS}
                                />
                            </li>
                            <li className='col col__reply'>
                                <div>
                                    {rootOptions}
                                </div>
                            </li>
                        </ul>
                        <div className='post__body'>
                            <div
                                ref='message_holder'
                                onClick={TextFormatting.handleClick}
                                dangerouslySetInnerHTML={{__html: TextFormatting.formatText(post.message)}}
                            />
                            <PostBodyAdditionalContent
                                post={post}
                            />
                            {fileAttachment}
                        </div>
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
