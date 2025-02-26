// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import {isMessageAttachmentArray} from '@mattermost/types/message_attachments';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile as UserProfileType} from '@mattermost/types/users';

import CommentedOnFilesMessage from 'components/post_view/commented_on_files_message';
import UserProfile from 'components/user_profile';

import {stripMarkdown} from 'utils/markdown';
import * as Utils from 'utils/utils';

type Props = {
    enablePostUsernameOverride?: boolean;
    parentPostUser?: UserProfileType;
    onCommentClick?: React.EventHandler<React.MouseEvent>;
    post: Post;
};

function CommentedOn({post, parentPostUser, onCommentClick}: Props) {
    const makeCommentedOnMessage = () => {
        let message: React.ReactNode = '';
        if (post.message) {
            message = Utils.replaceHtmlEntities(post.message);
        } else if (post.file_ids && post.file_ids.length > 0) {
            message = (
                <CommentedOnFilesMessage parentPostId={post.id}/>
            );
        } else if (isMessageAttachmentArray(post.props?.attachments) && post.props.attachments.length > 0) {
            const attachment = post.props.attachments[0];
            const webhookMessage = attachment.pretext || attachment.title || attachment.text || attachment.fallback || '';
            message = Utils.replaceHtmlEntities(webhookMessage);
        }

        return message;
    };

    const message = makeCommentedOnMessage();
    const parentPostUserId = parentPostUser?.id ?? '';

    const parentUserProfile = (
        <UserProfile
            userId={parentPostUserId}
        />
    );

    return (
        <div
            data-testid='post-link'
            className='post__link'
        >
            <span>
                <FormattedMessage
                    id='post_body.commentedOn'
                    defaultMessage="Commented on {name}'s message: "
                    values={{
                        name: <a className='theme user_name'>{parentUserProfile}</a>,
                    }}
                />
                <a
                    className='theme'
                    onClick={onCommentClick}
                >
                    {typeof message === 'string' ? stripMarkdown(message) : message}
                </a>
            </span>
        </div>
    );
}

export default memo(CommentedOn);
