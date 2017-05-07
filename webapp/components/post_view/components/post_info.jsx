// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ReactDOM from 'react-dom';

import PostTime from './post_time.jsx';
import PostFlagIcon from 'components/common/post_flag_icon.jsx';
import DotMenu from 'components/common/dot_menu.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import * as PostActions from 'actions/post_actions.jsx';
import CommentIcon from 'components/common/comment_icon.jsx';

import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import Constants from 'utils/constants.jsx';
import {Overlay} from 'react-bootstrap';
import EmojiPicker from 'components/emoji_picker/emoji_picker.jsx';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class PostInfo extends React.Component {
    constructor(props) {
        super(props);

        this.removePost = this.removePost.bind(this);
        this.reactEmojiClick = this.reactEmojiClick.bind(this);
        this.emojiPickerClick = this.emojiPickerClick.bind(this);

        this.state = {
            showEmojiPicker: false,
            reactionPickerOffset: 21
        };
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

    reactEmojiClick(emoji) {
        const pickerOffset = 21;
        this.setState({showEmojiPicker: false, reactionPickerOffset: pickerOffset});
        const emojiName = emoji.name || emoji.aliases[0];
        PostActions.addReaction(this.props.post.channel_id, this.props.post.id, emojiName);
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
                />
            );

            if (Utils.isFeatureEnabled(Constants.PRE_RELEASE_FEATURES.EMOJI_PICKER_PREVIEW)) {
                react = (
                    <span>
                        <Overlay
                            show={this.state.showEmojiPicker}
                            placement='top'
                            rootClose={true}
                            container={this}
                            onHide={() => this.setState({showEmojiPicker: false})}
                            target={() => ReactDOM.findDOMNode(this.refs['reactIcon_' + post.id])}
                            animation={false}
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
        }

        let options;
        if (isEphemeral) {
            options = (
                <li className='col col__remove'>
                    {this.createRemovePostButton()}
                </li>
            );
        } else if (!isPending) {
            const dotMenu = (
                <DotMenu
                    idPrefix='center'
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
                    <li className='col col__reply'>
                        {dotMenu}
                        {react}
                        {comments}
                    </li>
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
                    <PostFlagIcon
                        idPrefix={'centerPostFlag'}
                        idCount={idCount}
                        postId={post.id}
                        isFlagged={this.props.isFlagged}
                        isEphemeral={isEphemeral}
                    />
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
    sameUser: false
};
PostInfo.propTypes = {
    post: React.PropTypes.object.isRequired,
    lastPostCount: React.PropTypes.number,
    commentCount: React.PropTypes.number.isRequired,
    isLastComment: React.PropTypes.bool.isRequired,
    handleCommentClick: React.PropTypes.func.isRequired,
    handleDropdownOpened: React.PropTypes.func.isRequired,
    sameUser: React.PropTypes.bool.isRequired,
    currentUser: React.PropTypes.object.isRequired,
    compactDisplay: React.PropTypes.bool,
    useMilitaryTime: React.PropTypes.bool.isRequired,
    isFlagged: React.PropTypes.bool
};
