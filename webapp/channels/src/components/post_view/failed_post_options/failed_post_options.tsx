// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, { memo, useCallback } from 'react';
import { FormattedMessage } from 'react-intl';

import AlertIcon from 'components/widgets/icons/alert_icon';

import type { FileInfo } from '@mattermost/types/files';
import type { Post } from '@mattermost/types/posts';

import type { ExtendedPost } from 'mattermost-redux/actions/posts';

type Props = {
    post: Post;
    className?: string;
    variant?: 'inline' | 'overlay' | 'header';
    showStatus?: boolean;
    actions: {
        createPost: (post: Post, files: FileInfo[]) => void;
        removePost: (post: ExtendedPost) => void;
    };
};

const FailedPostOptions = ({
    post,
    className,
    variant = 'inline',
    showStatus = true,
    actions,
}: Props) => {
    const retryPost = useCallback((): void => {
        const postDetails = { ...post };
        Reflect.deleteProperty(postDetails, 'id');
        actions.createPost(postDetails, []);
    }, [actions, post]);

    const deletePost = useCallback((): void => {
        actions.removePost(post);
    }, [actions, post]);

    const containerClass = classNames(
        'pending-post-actions',
        className,
        {
            'pending-post-actions--inline': variant === 'inline',
            'pending-post-actions--overlay': variant === 'overlay',
            'pending-post-actions--header': variant === 'header',
        },
    );

    const status = showStatus ? (
        <span
            className='post__status post__status--failed pending-post-actions__status'
            role='alert'
        >
            <AlertIcon className='pending-post-actions__status-icon' />
            <FormattedMessage
                id='post.status.failed'
                defaultMessage='Message failed'
            />
        </span>
    ) : null;

    return (
        <div className={containerClass}>
            {status}
            <div className='pending-post-actions__buttons'>
                <button
                    type='button'
                    className='pending-post-actions__button pending-post-actions__button--delete post-delete'
                    onClick={deletePost}
                >
                    <FormattedMessage
                        id='pending_post_actions.delete'
                        defaultMessage='Delete'
                    />
                </button>
                <button
                    type='button'
                    className='pending-post-actions__button pending-post-actions__button--retry post-retry'
                    onClick={retryPost}
                >
                    <FormattedMessage
                        id='pending_post_actions.retry'
                        defaultMessage='Retry'
                    />
                </button>
            </div>
        </div>
    );
};

export default memo(FailedPostOptions);




