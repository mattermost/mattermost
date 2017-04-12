// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserProfile from './user_profile.jsx';
import FileAttachmentListContainer from './file_attachment_list_container.jsx';
import PendingPostOptions from 'components/post_view/components/pending_post_options.jsx';
import PostMessageContainer from 'components/post_view/components/post_message_container.jsx';
import ProfilePicture from 'components/profile_picture.jsx';
import ReactionListContainer from 'components/post_view/components/reaction_list_container.jsx';
import RhsDropdown from 'components/rhs_dropdown.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import {flagPost, unflagPost, pinPost, unpinPost, addReaction} from 'actions/post_actions.jsx';

import TeamStore from 'stores/team_store.jsx';

import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';

import Constants from 'utils/constants.jsx';
import DelayedAction from 'utils/delayed_action.jsx';
import {Tooltip, OverlayTrigger, Overlay} from 'react-bootstrap';

import {FormattedMessage} from 'react-intl';

import EmojiPicker from 'components/emoji_picker/emoji_picker.jsx';
import ReactDOM from 'react-dom';

import loadingGif from 'images/load.gif';

import React from 'react';
import {Link} from 'react-router/es6';

export default class RhsComment extends React.Component {
    constructor(props) {
        super(props);

        this.handlePermalink = this.handlePermalink.bind(this);
        this.removePost = this.removePost.bind(this);
        this.flagPost = this.flagPost.bind(this);
        this.unflagPost = this.unflagPost.bind(this);
        this.pinPost = this.pinPost.bind(this);
        this.unpinPost = this.unpinPost.bind(this);
        this.reactEmojiClick = this.reactEmojiClick.bind(this);
        this.emojiPickerClick = this.emojiPickerClick.bind(this);

        this.canEdit = false;
        this.canDelete = false;
        this.editDisableAction = new DelayedAction(this.handleEditDisable);

        this.state = {
            currentTeamDisplayName: TeamStore.getCurrent().name,
            width: '',
            height: '',
            showReactEmojiPicker: false,
            reactPickerOffset: 15
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

    handleEditDisable() {
        this.canEdit = false;
    }

    removePost() {
        GlobalActions.emitRemovePost(this.props.post);
    }

    createRemovePostButton() {
        return (
            <a
                href='#'
                className='post__remove theme'
                type='button'
                onClick={this.removePost}
            >
                {'×'}
            </a>
        );
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

        if (!Utils.areObjectsEqual(nextProps.post, this.props.post)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.currentUser, this.props.currentUser)) {
            return true;
        }

        if (this.state.showReactEmojiPicker !== nextState.showReactEmojiPicker) {
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

    pinPost(e) {
        e.preventDefault();
        pinPost(this.props.post.channel_id, this.props.post.id);
    }

    unpinPost(e) {
        e.preventDefault();
        unpinPost(this.props.post.channel_id, this.props.post.id);
    }

    createDropdown() {
        const post = this.props.post;

        if (post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING) {
            return '';
        }

        this.canDelete = PostUtils.canDeletePost(post);
        this.canEdit = PostUtils.canEditPost(post, this.editDisableAction);

        var dropdownContents = [];

        if (Utils.isMobile()) {
            if (this.props.isFlagged) {
                dropdownContents.push(
                    <li
                        key='mobileFlag'
                        role='presentation'
                    >
                        <a
                            href='#'
                            onClick={this.unflagPost}
                        >
                            <FormattedMessage
                                id='rhs_root.mobile.unflag'
                                defaultMessage='Unflag'
                            />
                        </a>
                    </li>
                );
            } else {
                dropdownContents.push(
                    <li
                        key='mobileFlag'
                        role='presentation'
                    >
                        <a
                            href='#'
                            onClick={this.flagPost}
                        >
                            <FormattedMessage
                                id='rhs_root.mobile.flag'
                                defaultMessage='Flag'
                            />
                        </a>
                    </li>
                );
            }
        }

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
                        id='rhs_comment.permalink'
                        defaultMessage='Permalink'
                    />
                </a>
            </li>
        );

        if (post.is_pinned) {
            dropdownContents.push(
                <li
                    key='rhs-comment-unpin'
                    role='presentation'
                >
                    <a
                        href='#'
                        onClick={this.unpinPost}
                    >
                        <FormattedMessage
                            id='rhs_root.unpin'
                            defaultMessage='Un-pin from channel'
                        />
                    </a>
                </li>
            );
        } else {
            dropdownContents.push(
                <li
                    key='rhs-comment-pin'
                    role='presentation'
                >
                    <a
                        href='#'
                        onClick={this.pinPost}
                    >
                        <FormattedMessage
                            id='rhs_root.pin'
                            defaultMessage='Pin to channel'
                        />
                    </a>
                </li>
            );
        }

        if (this.canDelete) {
            dropdownContents.push(
                <li
                    role='presentation'
                    key='delete-button'
                >
                    <a
                        href='#'
                        role='menuitem'
                        onClick={(e) => {
                            e.preventDefault();
                            GlobalActions.showDeletePostModal(post, 0);
                        }}
                    >
                        <FormattedMessage
                            id='rhs_comment.del'
                            defaultMessage='Delete'
                        />
                    </a>
                </li>
            );
        }

        if (this.canEdit) {
            dropdownContents.push(
                <li
                    role='presentation'
                    key='edit-button'
                    className={this.canEdit ? '' : 'hide'}
                >
                    <a
                        href='#'
                        role='menuitem'
                        data-toggle='modal'
                        data-target='#edit_post'
                        data-refocusid='#reply_textbox'
                        data-title={Utils.localizeMessage('rhs_comment.comment', 'Comment')}
                        data-message={post.message}
                        data-postid={post.id}
                        data-channelid={post.channel_id}
                    >
                        <FormattedMessage
                            id='rhs_comment.edit'
                            defaultMessage='Edit'
                        />
                    </a>
                </li>
            );
        }

        if (dropdownContents.length === 0) {
            return '';
        }

        return (
            <RhsDropdown dropdownContents={dropdownContents}/>
        );
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

    emojiPickerClick() {
        // set default offset
        let reactOffset = 15;
        const reactSelectorHeight = 360;
        const reactionIconY = ReactDOM.findDOMNode(this).getBoundingClientRect().top;
        const rhsMinHeight = 700;

        const spaceAvail = rhsMinHeight - reactionIconY;
        if (spaceAvail < reactSelectorHeight) {
            reactOffset = (spaceAvail - reactSelectorHeight);
        }
        this.setState({showReactEmojiPicker: !this.state.showReactEmojiPicker, reactPickerOffset: reactOffset});
    }

    reactEmojiClick(emoji) {
        this.setState({showReactEmojiPicker: false});
        const emojiName = emoji.name || emoji.aliases[0];
        addReaction(this.props.post.channel_id, this.props.post.id, emojiName);
    }

    render() {
        const post = this.props.post;
        const flagIcon = Constants.FLAG_ICON_SVG;
        const mattermostLogo = Constants.MATTERMOST_ICON_SVG;
        const isSystemMessage = PostUtils.isSystemMessage(post);
        let canReact = false;

        if (post.state !== Constants.POST_FAILED &&
            post.state !== Constants.POST_LOADING &&
            !Utils.isPostEphemeral(post) &&
            Utils.isFeatureEnabled(Constants.PRE_RELEASE_FEATURES.EMOJI_PICKER_PREVIEW)) {
            canReact = true;
        }

        var currentUserCss = '';
        if (this.props.currentUser.id === post.user_id) {
            currentUserCss = 'current--user';
        }

        var timestamp = this.props.currentUser.last_picture_update;

        let status = this.props.status;
        if (post.props && post.props.from_webhook === 'true') {
            status = null;
        }

        let botIndicator;
        let userProfile = (
            <UserProfile
                user={this.props.user}
                status={status}
                isBusy={this.props.isBusy}
            />
        );

        if (post.props && post.props.from_webhook) {
            if (post.props.override_username && global.window.mm_config.EnablePostUsernameOverride === 'true') {
                userProfile = (
                    <UserProfile
                        user={this.props.user}
                        overwriteName={post.props.override_username}
                        disablePopover={true}
                    />
                );
            } else {
                userProfile = (
                    <UserProfile
                        user={this.props.user}
                        disablePopover={true}
                    />
                );
            }

            botIndicator = <li className='col col__name bot-indicator'>{'BOT'}</li>;
        } else if (PostUtils.isSystemMessage(post)) {
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

        let loading;
        let postClass = '';

        if (post.state === Constants.POST_FAILED) {
            postClass += ' post-fail';
            loading = <PendingPostOptions post={this.props.post}/>;
        } else if (post.state === Constants.POST_LOADING) {
            postClass += ' post-waiting';
            loading = (
                <img
                    className='post-loading-gif pull-right'
                    src={loadingGif}
                />
            );
        }

        if (PostUtils.isEdited(this.props.post)) {
            postClass += ' post--edited';
        }

        let systemMessageClass = '';
        if (isSystemMessage) {
            systemMessageClass = 'post--system';
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

        if (PostUtils.isSystemMessage(post)) {
            profilePic = (
                <span
                    className='icon'
                    dangerouslySetInnerHTML={{__html: mattermostLogo}}
                />
            );
        }

        let compactClass = '';
        if (this.props.compactDisplay) {
            compactClass = 'post--compact';

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

        const profilePicContainer = (<div className='post__img'>{profilePic}</div>);

        let fileAttachment = null;
        if (post.file_ids && post.file_ids.length > 0) {
            fileAttachment = (
                <FileAttachmentListContainer
                    post={post}
                    compactDisplay={this.props.compactDisplay}
                />
            );
        }

        let flag;
        let flagFunc;
        let flagVisible = '';
        let flagTooltip = (
            <Tooltip id='flagTooltip'>
                <FormattedMessage
                    id='flag_post.flag'
                    defaultMessage='Flag for follow up'
                />
            </Tooltip>
        );
        if (this.props.isFlagged) {
            flagVisible = 'visible';
            flag = (
                <span
                    className='icon'
                    dangerouslySetInnerHTML={{__html: flagIcon}}
                />
            );
            flagFunc = this.unflagPost;
            flagTooltip = (
                <Tooltip id='flagTooltip'>
                    <FormattedMessage
                        id='flag_post.unflag'
                        defaultMessage='Unflag'
                    />
                </Tooltip>
            );
        } else {
            flag = (
                <span
                    className='icon'
                    dangerouslySetInnerHTML={{__html: flagIcon}}
                />
            );
            flagFunc = this.flagPost;
        }

        let flagTrigger;
        if (!Utils.isPostEphemeral(post)) {
            flagTrigger = (
                <OverlayTrigger
                    key={'commentflagtooltipkey' + flagVisible}
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='top'
                    overlay={flagTooltip}
                >
                    <a
                        href='#'
                        className={'flag-icon__container ' + flagVisible}
                        onClick={flagFunc}
                    >
                        {flag}
                    </a>
                </OverlayTrigger>
            );
        }

        let react;
        let reactOverlay;

        if (canReact) {
            react = (
                <span>
                    <a
                        href='#'
                        className='reacticon__container reaction'
                        onClick={this.emojiPickerClick}
                        ref={'rhs_reacticon_' + post.id}
                    ><i className='fa fa-smile-o'/>
                    </a>
                </span>

            );
            reactOverlay = (
                <Overlay
                    id={'rhs_react_overlay_' + post.id}
                    show={this.state.showReactEmojiPicker}
                    placement='top'
                    rootClose={true}
                    container={this.refs['post_body_' + post.id]}
                    onHide={() => this.setState({showReactEmojiPicker: false})}
                    target={() => ReactDOM.findDOMNode(this.refs['rhs_reacticon_' + post.id])}

                >
                    <EmojiPicker
                        onEmojiClick={this.reactEmojiClick}
                        pickerLocation='react-rhs-comment'
                        emojiOffset={this.state.reactPickerOffset}
                    />
                </Overlay>
            );
        }

        let options;
        if (Utils.isPostEphemeral(post)) {
            options = (
                <li className='col col__remove'>
                    {this.createRemovePostButton()}
                </li>
            );
        } else if (!PostUtils.isSystemMessage(post)) {
            options = (
                <li className='col col__reply'>
                    {reactOverlay}
                    {this.createDropdown()}
                    {react}
                </li>
            );
        }

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
                ref={'post_body_' + post.id}
                className={'post post--thread ' + currentUserCss + ' ' + compactClass + ' ' + systemMessageClass}
            >
                <div className='post__content'>
                    {profilePicContainer}
                    <div>
                        <ul className='post__header'>
                            <li className='col col__name'>
                                <strong>{userProfile}</strong>
                            </li>
                            {botIndicator}
                            <li className='col'>
                                {this.renderTimeTag(post, timeOptions)}
                                {pinnedBadge}
                                {flagTrigger}
                            </li>
                            {options}
                        </ul>
                        <div className='post__body' >
                            <div className={postClass}>
                                {loading}
                                <PostMessageContainer post={post}/>
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

RhsComment.propTypes = {
    post: React.PropTypes.object,
    user: React.PropTypes.object.isRequired,
    currentUser: React.PropTypes.object.isRequired,
    compactDisplay: React.PropTypes.bool,
    useMilitaryTime: React.PropTypes.bool.isRequired,
    isFlagged: React.PropTypes.bool,
    status: React.PropTypes.string,
    isBusy: React.PropTypes.bool
};
