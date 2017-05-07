// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserProfile from './user_profile.jsx';
import PostBodyAdditionalContent from 'components/post_view/components/post_body_additional_content.jsx';
import PostMessageContainer from 'components/post_view/components/post_message_container.jsx';
import FileAttachmentListContainer from './file_attachment_list_container.jsx';
import ProfilePicture from 'components/profile_picture.jsx';
import ReactionListContainer from 'components/post_view/components/reaction_list_container.jsx';
import DotMenu from 'components/common/dot_menu.jsx';
import PostFlagIcon from 'components/common/post_flag_icon.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import {flagPost, unflagPost, pinPost, unpinPost, addReaction} from 'actions/post_actions.jsx';

import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';

import EmojiPicker from 'components/emoji_picker/emoji_picker.jsx';
import ReactDOM from 'react-dom';

import Constants from 'utils/constants.jsx';
import DelayedAction from 'utils/delayed_action.jsx';
import {Overlay} from 'react-bootstrap';

import {FormattedMessage} from 'react-intl';

import React from 'react';
import {Link} from 'react-router/es6';

export default class RhsRootPost extends React.Component {
    constructor(props) {
        super(props);

        this.handlePermalink = this.handlePermalink.bind(this);
        this.flagPost = this.flagPost.bind(this);
        this.unflagPost = this.unflagPost.bind(this);
        this.pinPost = this.pinPost.bind(this);
        this.unpinPost = this.unpinPost.bind(this);
        this.reactEmojiClick = this.reactEmojiClick.bind(this);
        this.emojiPickerClick = this.emojiPickerClick.bind(this);

        this.editDisableAction = new DelayedAction(this.handleEditDisable);

        this.state = {
            currentTeamDisplayName: TeamStore.getCurrent().name,
            width: '',
            height: '',
            showRHSEmojiPicker: false,
            testStateObj: true
        };
    }

    componentDidMount() {
        window.addEventListener('resize', () => {
            Utils.updateWindowDimensions(this);
        });
    }

    componentWillUnmount() {
        window.removeEventListener('resize', () => {
            Utils.updateWindowDimensions(this);
        });
    }

    handlePermalink(e) {
        e.preventDefault();
        GlobalActions.showGetPostLinkModal(this.props.post);
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps.status !== this.props.status) {
            return true;
        }

        if (nextProps.isBusy !== this.props.isBusy) {
            return true;
        }

        if (nextProps.compactDisplay !== this.props.compactDisplay) {
            return true;
        }

        if (nextProps.useMilitaryTime !== this.props.useMilitaryTime) {
            return true;
        }

        if (nextProps.isFlagged !== this.props.isFlagged) {
            return true;
        }

        if (nextProps.previewCollapsed !== this.props.previewCollapsed) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.post, this.props.post)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.user, this.props.user)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.currentUser, this.props.currentUser)) {
            return true;
        }

        if (this.state.showRHSEmojiPicker !== nextState.showRHSEmojiPicker) {
            return true;
        }

        return false;
    }

    flagPost(e) {
        e.preventDefault();
        flagPost(this.props.post.id);
    }

    unflagPost(e) {
        e.preventDefault();
        unflagPost(this.props.post.id);
    }

    timeTag(post, timeOptions) {
        return (
            <time
                className='post__time'
                dateTime={Utils.getDateForUnixTicks(post.create_at).toISOString()}
            >
                {Utils.getDateForUnixTicks(post.create_at).toLocaleString('en', timeOptions)}
            </time>
        );
    }

    renderTimeTag(post, timeOptions) {
        return Utils.isMobile() ?
            this.timeTag(post, timeOptions) :
            (
                <Link
                    to={`/${this.state.currentTeamDisplayName}/pl/${post.id}`}
                    target='_blank'
                    className='post__permalink'
                >
                    {this.timeTag(post, timeOptions)}
                </Link>
            );
    }

    pinPost(e) {
        e.preventDefault();
        pinPost(this.props.post.channel_id, this.props.post.id);
    }

    unpinPost(e) {
        e.preventDefault();
        unpinPost(this.props.post.channel_id, this.props.post.id);
    }

    emojiPickerClick() {
        this.setState({showRHSEmojiPicker: !this.state.showRHSEmojiPicker});
    }

    reactEmojiClick(emoji) {
        this.setState({showRHSEmojiPicker: false});
        const emojiName = emoji.name || emoji.aliases[0];
        addReaction(this.props.post.channel_id, this.props.post.id, emojiName);
    }

    getClassName = (post, isSystemMessage) => {
        let className = 'post post--root post--thread';
        if (UserStore.getCurrentId() === post.user_id) {
            className += ' current--user';
        }

        if (isSystemMessage) {
            className += ' post--system';
        }

        if (this.props.compactDisplay) {
            className += 'post--compact';
        }

        if (post.is_pinned) {
            className += ' post--pinned';
        }

        return className;
    }

    render() {
        const post = this.props.post;
        const user = this.props.user;
        const mattermostLogo = Constants.MATTERMOST_ICON_SVG;
        var timestamp = user ? user.last_picture_update : 0;
        var channel = ChannelStore.get(post.channel_id);

        const isEphemeral = Utils.isPostEphemeral(post);
        const isPending = post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING;
        const isSystemMessage = PostUtils.isSystemMessage(post);

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

        let react;
        let reactOverlay;

        if (!isEphemeral && !isPending && !isSystemMessage && Utils.isFeatureEnabled(Constants.PRE_RELEASE_FEATURES.EMOJI_PICKER_PREVIEW)) {
            react = (
                <span>
                    <a
                        href='#'
                        className='reacticon__container reaction'
                        onClick={this.emojiPickerClick}
                        ref='rhs_root_reacticon'
                    ><i className='fa fa-smile-o'/>
                    </a>
                </span>

            );
            reactOverlay = (
                <Overlay
                    id='rhs_react_overlay'
                    show={this.state.showRHSEmojiPicker}
                    placement='bottom'
                    rootClose={true}
                    container={this}
                    onHide={() => this.setState({showRHSEmojiPicker: false})}
                    target={() => ReactDOM.findDOMNode(this.refs.rhs_root_reacticon)}
                    animation={false}
                >
                    <EmojiPicker
                        onEmojiClick={this.reactEmojiClick}
                        pickerLocation='react'
                    />
                </Overlay>
            );
        }

        const dotMenu = (
            <DotMenu
                idPrefix='rhsRoot'
                post={this.props.post}
                isFlagged={this.props.isFlagged}
            />
        );

        let fileAttachment = null;
        if (post.file_ids && post.file_ids.length > 0) {
            fileAttachment = (
                <FileAttachmentListContainer
                    post={post}
                    compactDisplay={this.props.compactDisplay}
                />
            );
        }

        let userProfile = (
            <UserProfile
                user={user}
                status={this.props.status}
                isBusy={this.props.isBusy}
            />
        );
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
            } else {
                userProfile = (
                    <UserProfile
                        user={user}
                        disablePopover={true}
                    />
                );
            }

            botIndicator = <li className='col col__name bot-indicator'>{'BOT'}</li>;
        } else if (isSystemMessage) {
            userProfile = (
                <UserProfile
                    user={{}}
                    overwriteName={
                        <FormattedMessage
                            id='post_info.system'
                            defaultMessage='System'
                        />
                    }
                    overwriteImage={Constants.SYSTEM_MESSAGE_PROFILE_IMAGE}
                    disablePopover={true}
                />
            );
        }

        let status = this.props.status;
        if (post.props && post.props.from_webhook === 'true') {
            status = null;
        }

        let profilePic = (
            <ProfilePicture
                src={PostUtils.getProfilePicSrcForPost(post, timestamp)}
                status={status}
                width='36'
                height='36'
                user={this.props.user}
                isBusy={this.props.isBusy}
            />
        );

        if (post.props && post.props.from_webhook) {
            profilePic = (
                <ProfilePicture
                    src={PostUtils.getProfilePicSrcForPost(post, timestamp)}
                    width='36'
                    height='36'
                />
            );
        }

        if (isSystemMessage) {
            profilePic = (
                <span
                    className='icon'
                    dangerouslySetInnerHTML={{__html: mattermostLogo}}
                />
            );
        }

        if (this.props.compactDisplay) {
            if (post.props && post.props.from_webhook) {
                profilePic = (
                    <ProfilePicture
                        src=''
                    />
                );
            } else {
                profilePic = (
                    <ProfilePicture
                        src=''
                        status={status}
                        user={this.props.user}
                        isBusy={this.props.isBusy}
                    />
                );
            }
        }

        let postClass = '';
        if (PostUtils.isEdited(this.props.post)) {
            postClass += ' post--edited';
        }

        const profilePicContainer = (<div className='post__img'>{profilePic}</div>);

        let pinnedBadge;
        if (post.is_pinned) {
            pinnedBadge = (
                <span className='post__pinned-badge'>
                    <FormattedMessage
                        id='post_info.pinned'
                        defaultMessage='Pinned'
                    />
                </span>
            );
        }

        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: !this.props.useMilitaryTime
        };

        return (
            <div
                id='thread--root'
                className={this.getClassName(post, isSystemMessage)}
            >
                <div className='post-right-channel__name'>{channelName}</div>
                <div className='post__content'>
                    {profilePicContainer}
                    <div>
                        <ul className='post__header'>
                            <li className='col__name'>{userProfile}</li>
                            {botIndicator}
                            <li className='col'>
                                {this.renderTimeTag(post, timeOptions)}
                                {pinnedBadge}
                                <PostFlagIcon
                                    idPrefix={'rhsRootPostFlag'}
                                    postId={post.id}
                                    isFlagged={this.props.isFlagged}
                                />
                            </li>
                            <li className='col col__reply'>
                                {reactOverlay}
                                {dotMenu}
                                {react}
                            </li>
                        </ul>
                        <div className='post__body'>
                            <div className={postClass}>
                                <PostBodyAdditionalContent
                                    post={post}
                                    message={<PostMessageContainer post={post}/>}
                                    previewCollapsed={this.props.previewCollapsed}
                                />
                            </div>
                            {fileAttachment}
                            <ReactionListContainer post={post}/>
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
    lastPostCount: React.PropTypes.number,
    user: React.PropTypes.object.isRequired,
    currentUser: React.PropTypes.object.isRequired,
    commentCount: React.PropTypes.number,
    compactDisplay: React.PropTypes.bool,
    useMilitaryTime: React.PropTypes.bool.isRequired,
    isFlagged: React.PropTypes.bool,
    status: React.PropTypes.string,
    previewCollapsed: React.PropTypes.string,
    isBusy: React.PropTypes.bool
};
