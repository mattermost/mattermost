// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import CommentedOnFilesMessage from 'components/post_view/commented_on_files_message';
import UserProfile from 'components/user_profile';

import {stripMarkdown} from 'utils/markdown';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

type Props = {
    onCommentClick?: React.EventHandler<React.MouseEvent>;
    rootId: string;
};

function CommentedOn({rootId, onCommentClick}: Props) {
    const post = useSelector((state: GlobalState) => getPost(state, rootId));
    const userId = useSelector((state: GlobalState) => (post ? getUser(state, post.user_id)?.id : undefined));

    if (!post || !userId) {
        return null;
    }

    const makeCommentedOnMessage = () => {
        let message: React.ReactNode = '';
        if (post.message) {
            message = Utils.replaceHtmlEntities(post.message);
        } else if (post.file_ids && post.file_ids.length > 0) {
            message = (
                <CommentedOnFilesMessage parentPostId={post.id}/>
            );
        } else if (post.props?.attachments?.length > 0) {
            const attachment = post.props.attachments[0];
            const webhookMessage = attachment.pretext || attachment.title || attachment.text || attachment.fallback || '';
            message = Utils.replaceHtmlEntities(webhookMessage);
        }

        return message;
    };

    const message = makeCommentedOnMessage();

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
                        name: <a className='theme user_name'>{<UserProfile userId={userId}/>}</a>,
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
