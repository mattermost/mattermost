// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostTime from './post_time.jsx';
import PostFlagIcon from 'components/common/post_flag_icon.jsx';
import DotMenu from 'components/dot_menu/dot_menu.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import * as PostActions from 'actions/post_actions.jsx';
import CommentIcon from 'components/common/comment_icon.jsx';

import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import Constants from 'utils/constants.jsx';
import EmojiPickerOverlay from 'components/emoji_picker/emoji_picker_overlay.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class PostInfo extends React.Component {
    constructor(props) {
        super(props);

        this.removePost = this.removePost.bind(this);
        this.reactEmojiClick = this.reactEmojiClick.bind(this);

        this.state = {
            showEmojiPicker: false,
            reactionPickerOffset: 21
        };
    }

    toggleEmojiPicker = () => {
        const showEmojiPicker = !this.state.showEmojiPicker;

        this.setState({showEmojiPicker});
        this.props.handleDropdownOpened(showEmojiPicker);
    }

    hideEmojiPicker = () => {
        this.setState({showEmojiPicker: false});
        this.props.handleDropdownOpened(false);
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

    reactEmojiClick(emoji) {
        const pickerOffset = 21;
        this.setState({showEmojiPicker: false, reactionPickerOffset: pickerOffset});
        const emojiName = emoji.name || emoji.aliases[0];
        PostActions.addReaction(this.props.post.channel_id, this.props.post.id, emojiName);
    }

    getDotMenu = () => {
        return this.refs.dotMenu;
    }

    render() {
        var post = this.props.post;

        let idCount = -1;
        if (this.props.lastPostCount >= 0 && this.props.lastPostCount < Constants.TEST_ID_COUNT) {
            idCount = this.props.lastPostCount;
        }

        const isEphemeral = Utils.isPostEphemeral(post);
        const isPending = post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING;
        const isSystemMessage = PostUtils.isSystemMessage(post);

        let comments = null;
        let react = null;
        if (!isEphemeral && !isPending && !isSystemMessage) {
            comments = (
                <CommentIcon
                    idPrefix={'commentIcon'}
                    idCount={idCount}
                    handleCommentClick={this.props.handleCommentClick}
                    commentCount={this.props.commentCount}
                    id={ChannelStore.getCurrentId() + '_' + post.id}
                />
            );

            if (Utils.isFeatureEnabled(Constants.PRE_RELEASE_FEATURES.EMOJI_PICKER_PREVIEW)) {
                react = (
                    <span>
                        <EmojiPickerOverlay
                            show={this.state.showEmojiPicker}
                            container={this.props.getPostList}
                            target={this.getDotMenu}
                            onHide={this.hideEmojiPicker}
                            onEmojiClick={this.reactEmojiClick}
                        />
                        <a
                            href='#'
                            className='reacticon__container'
                            onClick={this.toggleEmojiPicker}
                        >
                            <i className='fa fa-smile-o'/>
                        </a>
                    </span>
                );
            }
        }

        let options;
        if (isEphemeral) {
            options = (
                <div className='col col__remove'>
                    {this.createRemovePostButton()}
                </div>
            );
        } else if (!isPending) {
            const dotMenu = (
                <DotMenu
                    idPrefix={Constants.CENTER}
                    idCount={idCount}
                    post={this.props.post}
                    commentCount={this.props.commentCount}
                    isFlagged={this.props.isFlagged}
                    handleCommentClick={this.props.handleCommentClick}
                    handleDropdownOpened={this.props.handleDropdownOpened}
                />
            );

            if (dotMenu) {
                options = (
                    <div
                        ref='dotMenu'
                        className='col col__reply'
                    >
                        {dotMenu}
                        {react}
                        {comments}
                    </div>
                );
            }
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
            <div className='post__header--info'>
                <div className='col'>
                    <PostTime
                        eventTime={post.create_at}
                        sameUser={this.props.sameUser}
                        compactDisplay={this.props.compactDisplay}
                        useMilitaryTime={this.props.useMilitaryTime}
                        postId={post.id}
                    />
                    {pinnedBadge}
                    {this.state.showEmojiPicker}
                    <PostFlagIcon
                        idPrefix={'centerPostFlag'}
                        idCount={idCount}
                        postId={post.id}
                        isFlagged={this.props.isFlagged}
                        isEphemeral={isEphemeral}
                    />
                </div>
                {options}
            </div>
        );
    }
}

PostInfo.defaultProps = {
    post: null,
    commentCount: 0,
    isLastComment: false,
    sameUser: false
};
PostInfo.propTypes = {
    post: PropTypes.object.isRequired,
    lastPostCount: PropTypes.number,
    commentCount: PropTypes.number.isRequired,
    isLastComment: PropTypes.bool.isRequired,
    handleCommentClick: PropTypes.func.isRequired,
    handleDropdownOpened: PropTypes.func.isRequired,
    sameUser: PropTypes.bool.isRequired,
    currentUser: PropTypes.object.isRequired,
    compactDisplay: PropTypes.bool,
    useMilitaryTime: PropTypes.bool.isRequired,
    isFlagged: PropTypes.bool,
    getPostList: PropTypes.func.isRequired
};
