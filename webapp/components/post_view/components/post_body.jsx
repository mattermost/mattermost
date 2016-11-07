// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';
import * as Utils from 'utils/utils.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import Constants from 'utils/constants.jsx';
import CommentedOnFilesMessageContainer from './commented_on_files_message_container.jsx';
import FileAttachmentListContainer from 'components/file_attachment_list_container.jsx';
import PostBodyAdditionalContent from './post_body_additional_content.jsx';
import PostMessageContainer from './post_message_container.jsx';
import PendingPostOptions from './pending_post_options.jsx';

import {FormattedMessage} from 'react-intl';

import loadingGif from 'images/load.gif';

import React from 'react';

export default class PostBody extends React.Component {
    constructor(props) {
        super(props);

        this.removePost = this.removePost.bind(this);
    }

    shouldComponentUpdate(nextProps) {
        if (nextProps.isCommentMention !== this.props.isCommentMention) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.post, this.props.post)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.parentPost, this.props.parentPost)) {
            return true;
        }

        if (nextProps.compactDisplay !== this.props.compactDisplay) {
            return true;
        }

        if (nextProps.previewCollapsed !== this.props.previewCollapsed) {
            return true;
        }

        if (nextProps.handleCommentClick.toString() !== this.props.handleCommentClick.toString()) {
            return true;
        }

        return false;
    }

    removePost() {
        GlobalActions.emitRemovePost(this.props.post);
    }

    render() {
        const post = this.props.post;
        const parentPost = this.props.parentPost;

        let comment = '';
        let postClass = '';

        if (parentPost) {
            const profile = UserStore.getProfile(parentPost.user_id);

            let apostrophe = '';
            let name = '...';
            if (profile != null) {
                let username = profile.username;
                if (parentPost.props &&
                        parentPost.props.from_webhook &&
                        parentPost.props.override_username &&
                        global.window.mm_config.EnablePostUsernameOverride === 'true') {
                    username = parentPost.props.override_username;
                }

                if (username.slice(-1) === 's') {
                    apostrophe = '\'';
                } else {
                    apostrophe = '\'s';
                }
                name = (
                    <a
                        className='theme'
                        onClick={Utils.searchForTerm.bind(null, username)}
                    >
                        {username}
                    </a>
                );
            }

            let message = '';
            if (parentPost.message) {
                message = Utils.replaceHtmlEntities(parentPost.message);
            } else if (parentPost.file_ids && parentPost.file_ids.length > 0) {
                message = (
                    <CommentedOnFilesMessageContainer
                        parentPostChannelId={parentPost.channel_id}
                        parentPostId={parentPost.id}
                    />
                );
            }

            comment = (
                <div className='post__link'>
                    <span>
                        <FormattedMessage
                            id='post_body.commentedOn'
                            defaultMessage='Commented on {name}{apostrophe} message: '
                            values={{
                                name,
                                apostrophe
                            }}
                        />
                        <a
                            className='theme'
                            onClick={this.props.handleCommentClick}
                        >
                            {message}
                        </a>
                    </span>
                </div>
            );
        }

        let loading;
        if (post.state === Constants.POST_FAILED) {
            postClass += ' post--fail';
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

        let fileAttachmentHolder = null;
        if (((post.file_ids && post.file_ids.length > 0) || (post.filenames && post.filenames.length > 0)) && this.props.post.state !== Constants.POST_DELETED) {
            fileAttachmentHolder = (
                <FileAttachmentListContainer
                    post={post}
                    compactDisplay={this.props.compactDisplay}
                />
            );
        }

        let message;
        if (this.props.post.state === Constants.POST_DELETED) {
            message = (
                <p>
                    <FormattedMessage
                        id='post_body.deleted'
                        defaultMessage='(message deleted)'
                    />
                </p>
            );
        } else {
            message = (
                <PostMessageContainer post={this.props.post}/>
            );
        }

        const messageWrapper = (
            <div
                key={`${post.id}_message`}
                id={`${post.id}_message`}
                className={postClass}
            >
                {loading}
                {message}
            </div>
        );

        let messageWithAdditionalContent;
        if (this.props.post.state === Constants.POST_DELETED) {
            messageWithAdditionalContent = messageWrapper;
        } else {
            messageWithAdditionalContent = (
                <PostBodyAdditionalContent
                    post={this.props.post}
                    message={messageWrapper}
                    compactDisplay={this.props.compactDisplay}
                    previewCollapsed={this.props.previewCollapsed}
                />
            );
        }

        let mentionHighlightClass = '';
        if (this.props.isCommentMention) {
            mentionHighlightClass = 'mention-comment';
        }

        return (
            <div>
                {comment}
                <div className={'post__body ' + mentionHighlightClass}>
                    {messageWithAdditionalContent}
                    {fileAttachmentHolder}
                </div>
            </div>
        );
    }
}

PostBody.propTypes = {
    post: React.PropTypes.object.isRequired,
    parentPost: React.PropTypes.object,
    retryPost: React.PropTypes.func.isRequired,
    handleCommentClick: React.PropTypes.func.isRequired,
    compactDisplay: React.PropTypes.bool,
    previewCollapsed: React.PropTypes.string,
    isCommentMention: React.PropTypes.bool
};
