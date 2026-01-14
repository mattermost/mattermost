// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {FileInfo} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import type {ExtendedPost} from 'mattermost-redux/actions/posts';

type Props = {
    post: Post;
    className?: string;
    actions: {
        createPost: (post: Post, files: FileInfo[]) => void;
        removePost: (post: ExtendedPost) => void;
    };
};

const FailedPostOptions = ({
    post,
    className,
    actions,
}: Props) => {
    const retryPost = useCallback((): void => {
        const postDetails = {...post};
        Reflect.deleteProperty(postDetails, 'id');
        actions.createPost(postDetails, []);
    }, [actions, post]);

    const deletePost = useCallback((): void => {
        actions.removePost(post);
    }, [actions, post]);

    return (
        <div className={classNames('pending-post-actions', className)}>
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
