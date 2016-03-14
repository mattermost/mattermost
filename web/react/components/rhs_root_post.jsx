// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChannelStore from '../stores/channel_store.jsx';
import UserProfile from './user_profile.jsx';
import UserStore from '../stores/user_store.jsx';
import * as TextFormatting from '../utils/text_formatting.jsx';
import * as Utils from '../utils/utils.jsx';
import * as Emoji from '../utils/emoticons.jsx';
import FileAttachmentList from './file_attachment_list.jsx';
import twemoji from 'twemoji';
import PostBodyAdditionalContent from './post_body_additional_content.jsx';
import * as GlobalActions from '../action_creators/global_actions.jsx';

import Constants from '../utils/constants.jsx';

import {FormattedMessage, FormattedDate} from 'mm-intl';

export default class RhsRootPost extends React.Component {
    constructor(props) {
        super(props);

        this.parseEmojis = this.parseEmojis.bind(this);
        this.handlePermalink = this.handlePermalink.bind(this);

        this.state = {};
    }
    parseEmojis() {
        twemoji.parse(ReactDOM.findDOMNode(this), {
            className: 'emoji twemoji',
            base: '',
            folder: Emoji.getImagePathForEmoticon()
        });
    }
    handlePermalink(e) {
        e.preventDefault();
        GlobalActions.showGetPostLinkModal(this.props.post);
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
    render() {
        const post = this.props.post;
        const user = this.props.user;
        var isOwner = user.id === post.user_id;
        var isAdmin = Utils.isAdmin(user.roles);
        var timestamp = UserStore.getProfile(post.user_id).update_at;
        var channel = ChannelStore.get(post.channel_id);

        var type = 'Post';
        if (post.root_id.length > 0) {
            type = 'Comment';
        }

        var userCss = '';
        if (UserStore.getCurrentId() === post.user_id) {
            userCss = 'current--user';
        }

        var systemMessageClass = '';
        if (Utils.isSystemMessage(post)) {
            systemMessageClass = 'post--system';
        }

        var channelName;
        if (channel) {
            if (channel.type === 'D') {
                channelName = (
                    <FormattedMessage
                        id='rhs_root.direct'
                        defaultMessage='Direct Message'
                    />
                );
            } else {
                channelName = channel.display_name;
            }
        }

        var dropdownContents = [];

        if (!Utils.isMobile()) {
            dropdownContents.push(
                <li
                    key='rhs-root-permalink'
                    role='presentation'
                >
                    <a
                        href='#'
                        onClick={this.handlePermalink}
                    >
                        <FormattedMessage
                            id='rhs_root.permalink'
                            defaultMessage='Permalink'
                        />
                    </a>
                </li>
            );
        }

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
                        <FormattedMessage
                            id='rhs_root.edit'
                            defaultMessage='Edit'
                        />
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
                        onClick={() => GlobalActions.showDeletePostModal(post, this.props.commentCount)}
                    >
                        <FormattedMessage
                            id='rhs_root.del'
                            defaultMessage='Delete'
                        />
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

        let userProfile = <UserProfile user={user}/>;
        let botIndicator;

        if (post.props && post.props.from_webhook) {
            if (post.props.override_username && global.window.mm_config.EnablePostUsernameOverride === 'true') {
                userProfile = (
                    <UserProfile
                        user={user}
                        overwriteName={post.props.override_username}
                        disablePopover={true}
                    />
                );
            }

            botIndicator = <li className='col col__name bot-indicator'>{'BOT'}</li>;
        } else if (Utils.isSystemMessage(post)) {
            userProfile = (
                <UserProfile
                    user={{}}
                    overwriteName={Constants.SYSTEM_MESSAGE_PROFILE_NAME}
                    overwriteImage={Constants.SYSTEM_MESSAGE_PROFILE_IMAGE}
                    disablePopover={true}
                />
            );
        }

        let src = '/api/v1/users/' + post.user_id + '/image?time=' + timestamp;
        if (post.props && post.props.from_webhook && global.window.mm_config.EnablePostIconOverride === 'true') {
            if (post.props.override_icon_url) {
                src = post.props.override_icon_url;
            }
        } else if (Utils.isSystemMessage(post)) {
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
            <div className={'post post--root ' + userCss + ' ' + systemMessageClass}>
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
                                    <FormattedDate
                                        value={post.create_at}
                                        day='numeric'
                                        month='long'
                                        year='numeric'
                                        hour12={true}
                                        hour='2-digit'
                                        minute='2-digit'
                                    />
                                </time>
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
            </div>
        );
    }
}

RhsRootPost.defaultProps = {
    commentCount: 0
};
RhsRootPost.propTypes = {
    post: React.PropTypes.object.isRequired,
    user: React.PropTypes.object.isRequired,
    commentCount: React.PropTypes.number
};
