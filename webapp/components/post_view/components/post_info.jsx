// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';

import PostTime from './post_time.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import * as PostActions from 'actions/post_actions.jsx';

import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import Constants from 'utils/constants.jsx';
import DelayedAction from 'utils/delayed_action.jsx';
import {Tooltip, OverlayTrigger, Overlay} from 'react-bootstrap';
import EmojiPicker from 'components/emoji_picker/emoji_picker.jsx';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class PostInfo extends React.Component {
    constructor(props) {
        super(props);

        this.handleDropdownOpened = this.handleDropdownOpened.bind(this);
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
            showEmojiPicker: false,
            reactionPickerOffset: 21
        };
    }

    handleDropdownOpened() {
        this.props.handleDropdownOpened(true);

        const position = $('#post-list').height() - $(this.refs.dropdownToggle).offset().top;
        const dropdown = $(this.refs.dropdown);

        if (position < dropdown.height()) {
            dropdown.addClass('bottom');
        }
    }

    handleEditDisable() {
        this.canEdit = false;
    }

    componentDidMount() {
        $('#post_dropdown' + this.props.post.id).on('shown.bs.dropdown', this.handleDropdownOpened);
        $('#post_dropdown' + this.props.post.id).on('hidden.bs.dropdown', () => this.props.handleDropdownOpened(false));
    }

    createDropdown() {
        const post = this.props.post;
        const isSystemMessage = PostUtils.isSystemMessage(post);

        if (post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING) {
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

        if (this.props.allowReply) {
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
                        <FormattedMessage
                            id='post_info.reply'
                            defaultMessage='Reply'
                        />
                    </a>
                </li>
             );
        }

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

        if (!isSystemMessage) {
            dropdownContents.push(
                <li
                    key='copyLink'
                    role='presentation'
                >
                    <a
                        href='#'
                        onClick={this.handlePermalink}
                    >
                        <FormattedMessage
                            id='post_info.permalink'
                            defaultMessage='Permalink'
                        />
                    </a>
                </li>
            );
        }

        if (this.props.post.is_pinned) {
            dropdownContents.push(
                <li
                    key='unpinLink'
                    role='presentation'
                >
                    <a
                        href='#'
                        onClick={this.unpinPost}
                    >
                        <FormattedMessage
                            id='post_info.unpin'
                            defaultMessage='Un-pin from channel'
                        />
                    </a>
                </li>
            );
        } else {
            dropdownContents.push(
                <li
                    key='pinLink'
                    role='presentation'
                >
                    <a
                        href='#'
                        onClick={this.pinPost}
                    >
                        <FormattedMessage
                            id='post_info.pin'
                            defaultMessage='Pin to channel'
                        />
                    </a>
                </li>
            );
        }

        if (this.canDelete) {
            dropdownContents.push(
                <li
                    key='deletePost'
                    role='presentation'
                >
                    <a
                        href='#'
                        role='menuitem'
                        onClick={(e) => {
                            e.preventDefault();
                            GlobalActions.showDeletePostModal(post, dataComments);
                        }}
                    >
                        <FormattedMessage
                            id='post_info.del'
                            defaultMessage='Delete'
                        />
                    </a>
                </li>
            );
        }

        if (this.canEdit) {
            dropdownContents.push(
                <li
                    key='editPost'
                    role='presentation'
                    className={this.canEdit ? 'dropdown-submenu' : 'dropdown-submenu hide'}
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
                        <FormattedMessage
                            id='post_info.edit'
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
            <div
                id={'post_dropdown' + this.props.post.id}
            >
                <a
                    ref='dropdownToggle'
                    href='#'
                    className='dropdown-toggle post__dropdown theme'
                    type='button'
                    data-toggle='dropdown'
                    aria-expanded='false'
                />
                <div className='dropdown-menu__content'>
                    <ul
                        ref='dropdown'
                        className='dropdown-menu'
                        role='menu'
                    >
                        {dropdownContents}
                    </ul>
                </div>
            </div>
        );
    }

    handlePermalink(e) {
        e.preventDefault();
        GlobalActions.showGetPostLinkModal(this.props.post);
    }

    emojiPickerClick() {
        this.setState({showEmojiPicker: !this.state.showEmojiPicker});
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

    pinPost(e) {
        e.preventDefault();
        PostActions.pinPost(this.props.post.channel_id, this.props.post.id);
    }

    unpinPost(e) {
        e.preventDefault();
        PostActions.unpinPost(this.props.post.channel_id, this.props.post.id);
    }

    flagPost(e) {
        e.preventDefault();
        PostActions.flagPost(this.props.post.id);
    }

    unflagPost(e) {
        e.preventDefault();
        PostActions.unflagPost(this.props.post.id);
    }

    reactEmojiClick(emoji) {
        const pickerOffset = 21;

        const emojiName = emoji.name || emoji.aliases[0];
        PostActions.addReaction(this.props.post.channel_id, this.props.post.id, emojiName);
        this.setState({showEmojiPicker: false, reactionPickerOffset: pickerOffset});
    }

    render() {
        var post = this.props.post;
        var comments = '';
        var showCommentClass = '';
        var commentCountText = this.props.commentCount;
        const flagIcon = Constants.FLAG_ICON_SVG;

        this.canDelete = PostUtils.canDeletePost(post);
        this.canEdit = PostUtils.canEditPost(post, this.editDisableAction);

        if (this.props.commentCount >= 1) {
            showCommentClass = ' icon--show';
        } else {
            commentCountText = '';
        }

        if (post.state !== Constants.POST_FAILED && post.state !== Constants.POST_LOADING && !Utils.isPostEphemeral(post) && this.props.allowReply) {
            comments = (
                <a
                    href='#'
                    className={'comment-icon__container' + showCommentClass}
                    onClick={this.props.handleCommentClick}
                >
                    <span
                        className='comment-icon'
                        dangerouslySetInnerHTML={{__html: Constants.REPLY_ICON}}
                    />
                    <span className='comment-count'>
                        {commentCountText}
                    </span>
                </a>
            );
        }

        let react;
        if (post.state !== Constants.POST_FAILED &&
            post.state !== Constants.POST_LOADING &&
            !Utils.isPostEphemeral(post) &&
            Utils.isFeatureEnabled(Constants.PRE_RELEASE_FEATURES.EMOJI_PICKER_PREVIEW)) {
            react = (
                <span>
                    <Overlay
                        show={this.state.showEmojiPicker}
                        placement='top'
                        rootClose={true}
                        container={this}
                        onHide={() => this.setState({showEmojiPicker: false})}
                        target={() => ReactDOM.findDOMNode(this.refs['reactIcon_' + post.id])}

                    >
                        <EmojiPicker
                            onEmojiClick={this.reactEmojiClick}
                            pickerLocation='top'

                        />
                    </Overlay>
                    <a
                        href='#'
                        className='reacticon__container'
                        onClick={this.emojiPickerClick}
                        ref={'reactIcon_' + post.id}
                    ><i className='fa fa-smile-o'/>
                    </a>
                </span>

            );
        }

        let options;
        if (Utils.isPostEphemeral(post)) {
            options = (
                <li className='col col__remove'>
                    {this.createRemovePostButton()}
                </li>
            );
        } else {
            const dropdown = this.createDropdown();
            if (dropdown) {
                options = (
                    <li className='col col__reply'>
                        <div
                            className='dropdown'
                            ref='dotMenu'
                        >
                            {dropdown}
                        </div>
                        {react}
                        {comments}
                    </li>
                );
            }
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
                    key={'flagtooltipkey' + flagVisible}
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

        return (
            <ul className='post__header--info'>
                <li className='col'>
                    <PostTime
                        eventTime={post.create_at}
                        sameUser={this.props.sameUser}
                        compactDisplay={this.props.compactDisplay}
                        useMilitaryTime={this.props.useMilitaryTime}
                        postId={post.id}
                    />
                    {pinnedBadge}
                    {this.state.showEmojiPicker}
                    {flagTrigger}
                </li>
                {options}
            </ul>
        );
    }
}

PostInfo.defaultProps = {
    post: null,
    commentCount: 0,
    isLastComment: false,
    allowReply: false,
    sameUser: false
};
PostInfo.propTypes = {
    post: React.PropTypes.object.isRequired,
    commentCount: React.PropTypes.number.isRequired,
    isLastComment: React.PropTypes.bool.isRequired,
    allowReply: React.PropTypes.bool.isRequired,
    handleCommentClick: React.PropTypes.func.isRequired,
    handleDropdownOpened: React.PropTypes.func.isRequired,
    sameUser: React.PropTypes.bool.isRequired,
    currentUser: React.PropTypes.object.isRequired,
    compactDisplay: React.PropTypes.bool,
    useMilitaryTime: React.PropTypes.bool.isRequired,
    isFlagged: React.PropTypes.bool
};
