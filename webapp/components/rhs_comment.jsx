// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserProfile from './user_profile.jsx';
import FileAttachmentList from './file_attachment_list.jsx';

import PostStore from 'stores/post_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import * as GlobalActions from 'action_creators/global_actions.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';

import * as TextFormatting from 'utils/text_formatting.jsx';
import * as Utils from 'utils/utils.jsx';
import Client from 'utils/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import {FormattedMessage, FormattedDate} from 'react-intl';

import loadingGif from 'images/load.gif';

import React from 'react';
import ReactDOM from 'react-dom';
import twemoji from 'twemoji';

export default class RhsComment extends React.Component {
    constructor(props) {
        super(props);

        this.retryComment = this.retryComment.bind(this);
        this.parseEmojis = this.parseEmojis.bind(this);
        this.handlePermalink = this.handlePermalink.bind(this);

        this.state = {};
    }
    retryComment(e) {
        e.preventDefault();

        var post = this.props.post;
        Client.createPost(post,
            (data) => {
                AsyncClient.getPosts(post.channel_id);

                var channel = ChannelStore.get(post.channel_id);
                var member = ChannelStore.getMember(post.channel_id);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = (new Date()).getTime();
                ChannelStore.setChannelMember(member);

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_POST,
                    post: data
                });
            },
            () => {
                post.state = Constants.POST_FAILED;
                PostStore.updatePendingPost(post);
                this.forceUpdate();
            }
        );

        post.state = Constants.POST_LOADING;
        PostStore.updatePendingPost(post);
        this.forceUpdate();
    }
    parseEmojis() {
        twemoji.parse(ReactDOM.findDOMNode(this), {
            className: 'emoticon',
            base: '',
            folder: Constants.EMOJI_PATH
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
    createDropdown() {
        var post = this.props.post;

        if (post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING || post.state === Constants.POST_DELETED) {
            return '';
        }

        const isOwner = this.props.currentUser.id === post.user_id;
        const isAdmin = Utils.isAdmin(this.props.currentUser.roles);

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
                            id='rhs_comment.permalink'
                            defaultMessage='Permalink'
                        />
                    </a>
                </li>
            );
        }

        if (isOwner) {
            dropdownContents.push(
                <li
                    role='presentation'
                    key='edit-button'
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

        if (isOwner || isAdmin) {
            dropdownContents.push(
                <li
                    role='presentation'
                    key='delete-button'
                >
                    <a
                        href='#'
                        role='menuitem'
                        onClick={() => GlobalActions.showDeletePostModal(post, 0)}
                    >
                        <FormattedMessage
                            id='rhs_comment.del'
                            defaultMessage='Delete'
                        />
                    </a>
                </li>
            );
        }

        if (dropdownContents.length === 0) {
            return '';
        }

        return (
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
    render() {
        var post = this.props.post;

        var currentUserCss = '';
        if (this.props.currentUser === post.user_id) {
            currentUserCss = 'current--user';
        }

        var timestamp = this.props.currentUser.update_at;

        let loading;
        let postClass = '';
        let message = (
            <div
                ref='message_holder'
                onClick={TextFormatting.handleClick}
                dangerouslySetInnerHTML={{__html: TextFormatting.formatText(post.message)}}
            />
        );

        if (post.state === Constants.POST_FAILED) {
            postClass += ' post-fail';
            loading = (
                <a
                    className='theme post-retry pull-right'
                    href='#'
                    onClick={this.retryComment}
                >
                    <FormattedMessage
                        id='rhs_comment.retry'
                        defaultMessage='Retry'
                    />
                </a>
            );
        } else if (post.state === Constants.POST_LOADING) {
            postClass += ' post-waiting';
            loading = (
                <img
                    className='post-loading-gif pull-right'
                    src={loadingGif}
                />
            );
        } else if (this.props.post.state === Constants.POST_DELETED) {
            message = (
                <FormattedMessage
                    id='post_body.deleted'
                    defaultMessage='(message deleted)'
                />
            );
        }

        var dropdown = this.createDropdown();

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
            <div className={'post ' + currentUserCss}>
                <div className='post__content'>
                    <div className='post__img'>
                        <img
                            src={Client.getUsersRoute() + '/' + post.user_id + '/image?time=' + timestamp}
                            height='36'
                            width='36'
                        />
                    </div>
                    <div>
                        <ul className='post__header'>
                            <li className='col__name'>
                                <strong><UserProfile user={this.props.user}/></strong>
                            </li>
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
                                {dropdown}
                            </li>
                        </ul>
                        <div className='post__body'>
                            <div className={postClass}>
                                {loading}
                                {message}
                            </div>
                            {fileAttachment}
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
    currentUser: React.PropTypes.object.isRequired
};
