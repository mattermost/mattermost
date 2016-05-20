// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FileAttachmentList from 'components/file_attachment_list.jsx';
import UserStore from 'stores/user_store.jsx';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
import * as TextFormatting from 'utils/text_formatting.jsx';
import PostBodyAdditionalContent from './post_body_additional_content.jsx';

import {FormattedMessage} from 'react-intl';

import loadingGif from 'images/load.gif';

import React from 'react';

export default class PostBody extends React.Component {
    shouldComponentUpdate(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.post, this.props.post)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.parentPost, this.props.parentPost)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.compactDisplay, this.props.compactDisplay)) {
            return true;
        }

        if (nextProps.retryPost.toString() !== this.props.retryPost.toString()) {
            return true;
        }

        if (nextProps.handleCommentClick.toString() !== this.props.handleCommentClick.toString()) {
            return true;
        }

        return false;
    }

    render() {
        const post = this.props.post;
        const filenames = this.props.post.filenames;
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
            } else if (parentPost.filenames.length) {
                message = parentPost.filenames[0].split('/').pop();

                if (parentPost.filenames.length === 2) {
                    message += Utils.localizeMessage('post_body.plusOne', ' plus 1 other file');
                } else if (parentPost.filenames.length > 2) {
                    message += Utils.localizeMessage('post_body.plusMore', ' plus {count} other files').replace('{count}', (parentPost.filenames.length - 1).toString());
                }
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
            loading = (
                <a
                    className='theme post-retry pull-right'
                    href='#'
                    onClick={this.props.retryPost}
                >
                    <FormattedMessage
                        id='post_body.retry'
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
        }

        let fileAttachmentHolder = '';
        if (filenames && filenames.length > 0) {
            fileAttachmentHolder = (
                <FileAttachmentList

                    filenames={filenames}
                    channelId={post.channel_id}
                    userId={post.user_id}
                    compactDisplay={this.props.compactDisplay}
                />
            );
        }

        let message;
        let additionalContent = null;
        if (this.props.post.state === Constants.POST_DELETED) {
            message = (
                <FormattedMessage
                    id='post_body.deleted'
                    defaultMessage='(message deleted)'
                />
            );
        } else {
            message = (
                <span
                    onClick={TextFormatting.handleClick}
                    dangerouslySetInnerHTML={{__html: TextFormatting.formatText(this.props.post.message)}}
                />
            );

            additionalContent = (
                <PostBodyAdditionalContent post={this.props.post}/>
            );
        }

        return (
            <div>
                {comment}
                <div className='post__body'>
                    <div
                        key={`${post.id}_message`}
                        id={`${post.id}_message`}
                        className={postClass}
                    >
                        {loading}
                        {message}
                    </div>
                    {fileAttachmentHolder}
                    {additionalContent}
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
    compactDisplay: React.PropTypes.bool
};
