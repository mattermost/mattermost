// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ReactDOM from 'react-dom';

import PostTime from './post_time.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import * as PostActions from 'actions/post_actions.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import {Tooltip, OverlayTrigger, Overlay} from 'react-bootstrap';
import EmojiPicker from 'components/emoji_picker/emoji_picker.jsx';
import PostOptionDropdown from './post_option_dropdown.jsx';
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

    needReply() {
        const post = this.props.post;

        if (post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING) {
            return false;
        }
        return true;
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

        const emojiName = emoji.name || emoji.aliases[0];
        PostActions.addReaction(this.props.post.channel_id, this.props.post.id, emojiName);
        this.setState({showEmojiPicker: false, reactionPickerOffset: pickerOffset});
    }

    render() {
        var post = this.props.post;
        const flagIcon = Constants.FLAG_ICON_SVG;

        const isEphemeral = Utils.isPostEphemeral(post);
        const isPending = post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING;
        const isSystemMessage = PostUtils.isSystemMessage(post);

        let comments = null;
        let react = null;
        if (!isEphemeral && !isPending && !isSystemMessage) {
            let showCommentClass;
            let commentCountText;
            if (this.props.commentCount >= 1) {
                showCommentClass = ' icon--show';
                commentCountText = this.props.commentCount;
            } else {
                showCommentClass = '';
                commentCountText = '';
            }

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
            if (this.needReply()) {
                options = (
                    <li className='col col__reply'>
                        <PostOptionDropdown {...this.props}/>
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
        if (!isEphemeral) {
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
    sameUser: false
};
PostInfo.propTypes = {
    post: React.PropTypes.object.isRequired,
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
