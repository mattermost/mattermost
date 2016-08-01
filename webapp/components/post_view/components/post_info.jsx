// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import * as Utils from 'utils/utils.jsx';
import PostTime from './post_time.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class PostInfo extends React.Component {
    constructor(props) {
        super(props);

        this.handleDropdownClick = this.handleDropdownClick.bind(this);
        this.handlePermalink = this.handlePermalink.bind(this);
        this.removePost = this.removePost.bind(this);
    }
    handleDropdownClick(e) {
        var position = $('#post-list').height() - $(e.target).offset().top;
        var dropdown = $(e.target).closest('.col__reply').find('.dropdown-menu');
        if (position < dropdown.height()) {
            dropdown.addClass('bottom');
        }
    }
    componentDidMount() {
        $('#post_dropdown' + this.props.post.id).on('shown.bs.dropdown', () => this.props.handleDropdownOpened(true));
        $('#post_dropdown' + this.props.post.id).on('hidden.bs.dropdown', () => this.props.handleDropdownOpened(false));
    }
    createDropdown() {
        var post = this.props.post;
        var isOwner = this.props.currentUser.id === post.user_id;
        var isAdmin = TeamStore.isTeamAdminForCurrentTeam() || UserStore.isSystemAdminForCurrentUser();
        const isSystemMessage = post.type && post.type.startsWith(Constants.SYSTEM_MESSAGE_PREFIX);

        if (post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING || Utils.isPostEphemeral(post)) {
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

        if (this.props.allowReply === 'true') {
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

        if (isOwner || isAdmin) {
            dropdownContents.push(
                <li
                    key='deletePost'
                    role='presentation'
                >
                    <a
                        href='#'
                        role='menuitem'
                        onClick={() => GlobalActions.showDeletePostModal(post, dataComments)}
                    >
                        <FormattedMessage
                            id='post_info.del'
                            defaultMessage='Delete'
                        />
                    </a>
                </li>
            );
        }

        if (isOwner && !isSystemMessage) {
            dropdownContents.push(
                <li
                    key='editPost'
                    role='presentation'
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
                    href='#'
                    className='dropdown-toggle post__dropdown theme'
                    type='button'
                    data-toggle='dropdown'
                    aria-expanded='false'
                    onClick={this.handleDropdownClick}
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

    handlePermalink(e) {
        e.preventDefault();
        GlobalActions.showGetPostLinkModal(this.props.post);
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

    render() {
        var post = this.props.post;
        var comments = '';
        var showCommentClass = '';
        var highlightMentionClass = '';
        var commentCountText = this.props.commentCount;

        if (this.props.commentCount >= 1) {
            showCommentClass = ' icon--show';
        } else {
            commentCountText = '';
        }

        if (this.props.isCommentMention) {
            highlightMentionClass = ' mention--highlight';
        }

        if (post.state !== Constants.POST_FAILED && post.state !== Constants.POST_LOADING && !Utils.isPostEphemeral(post)) {
            comments = (
                <a
                    href='#'
                    className={'comment-icon__container' + showCommentClass + highlightMentionClass}
                    onClick={this.props.handleCommentClick}
                >
                    <span
                        className='comment-icon'
                        dangerouslySetInnerHTML={{__html: Constants.REPLY_ICON}}
                    />
                    {commentCountText}
                </a>
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
            options = (
                <li className='col col__reply'>
                    <div
                        className='dropdown'
                        ref='dotMenu'
                    >
                        {this.createDropdown()}
                    </div>
                    {comments}
                </li>
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
    allowReply: false,
    sameUser: false
};
PostInfo.propTypes = {
    post: React.PropTypes.object.isRequired,
    commentCount: React.PropTypes.number.isRequired,
    isCommentMention: React.PropTypes.bool.isRequired,
    isLastComment: React.PropTypes.bool.isRequired,
    allowReply: React.PropTypes.string.isRequired,
    handleCommentClick: React.PropTypes.func.isRequired,
    handleDropdownOpened: React.PropTypes.func.isRequired,
    sameUser: React.PropTypes.bool.isRequired,
    currentUser: React.PropTypes.object.isRequired,
    compactDisplay: React.PropTypes.bool,
    useMilitaryTime: React.PropTypes.bool.isRequired
};
