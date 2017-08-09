// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import * as PostActions from 'actions/post_actions.jsx';

import FileAttachmentListContainer from 'components/file_attachment_list';
import CommentedOnFilesMessage from 'components/post_view/commented_on_files_message';
import PostBodyAdditionalContent from 'components/post_view/post_body_additional_content.jsx';
import FailedPostOptions from 'components/post_view/failed_post_options';
import PostMessageView from 'components/post_view/post_message_view';
import ReactionListContainer from 'components/post_view/reaction_list';

import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';

import {Posts} from 'mattermost-redux/constants';

export default class PostBody extends React.PureComponent {
    static propTypes = {

        /**
         * The post to render the body of
         */
        post: PropTypes.object.isRequired,

        /**
         * The parent post of the thread this post is in
         */
        parentPost: PropTypes.object,

        /**
         * The poster of the parent post, if exists
         */
        parentPostUser: PropTypes.object,

        /**
         * The function called when the comment icon is clicked
         */
        handleCommentClick: PropTypes.func.isRequired,

        /**
         * Set to render post body compactly
         */
        compactDisplay: PropTypes.bool,

        /**
         * Set to highlight comment as a mention
         */
        isCommentMention: PropTypes.bool,

        /**
         * Set to collapse image and video previews
         */
        previewCollapsed: PropTypes.string,

        /**
         * Post identifiers for selenium tests
         */
        lastPostCount: PropTypes.number
    }

    render() {
        const post = this.props.post;
        const parentPost = this.props.parentPost;

        let comment = '';
        let postClass = '';

        if (parentPost && !Utils.isPostEphemeral(post)) {
            const profile = this.props.parentPostUser;

            let apostrophe = '';
            let name = '...';
            if (profile != null) {
                let username = Utils.displayUsernameForUser(profile);
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
                        onClick={PostActions.searchForTerm.bind(null, username)}
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
                    <CommentedOnFilesMessage
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

        let failedOptions;
        if (this.props.post.failed) {
            postClass += ' post--fail';
            failedOptions = <FailedPostOptions post={this.props.post}/>;
        }

        if (PostUtils.isEdited(this.props.post)) {
            postClass += ' post--edited';
        }

        let fileAttachmentHolder = null;
        if (((post.file_ids && post.file_ids.length > 0) || (post.filenames && post.filenames.length > 0)) && this.props.post.state !== Posts.POST_DELETED) {
            fileAttachmentHolder = (
                <FileAttachmentListContainer
                    post={post}
                    compactDisplay={this.props.compactDisplay}
                />
            );
        }

        const messageWrapper = (
            <div
                key={`${post.id}_message`}
                id={`${post.id}_message`}
                className={postClass}
            >
                {failedOptions}
                <PostMessageView
                    lastPostCount={this.props.lastPostCount}
                    post={this.props.post}
                    compactDisplay={this.props.compactDisplay}
                    hasMention={true}
                />
            </div>
        );

        let messageWithAdditionalContent;
        if (this.props.post.state === Posts.POST_DELETED) {
            messageWithAdditionalContent = messageWrapper;
        } else {
            messageWithAdditionalContent = (
                <PostBodyAdditionalContent
                    post={this.props.post}
                    message={messageWrapper}
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
                    <ReactionListContainer post={post}/>
                </div>
            </div>
        );
    }
}
