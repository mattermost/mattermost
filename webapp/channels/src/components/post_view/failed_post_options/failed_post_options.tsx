// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import type {MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import type {FileInfo} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import type {ExtendedPost} from 'mattermost-redux/actions/posts';

type Props = {
    post: Post;
    actions: {
        createPost: (post: Post, files: FileInfo[]) => void;
        removePost: (post: ExtendedPost) => void;
    };
};

const FailedPostOptions = ({
    post,
    actions,
}: Props) => {
    const retryPost = useCallback((e: MouseEvent): void => {
        e.preventDefault();

        const postDetails = {...post};
        Reflect.deleteProperty(postDetails, 'id');
        actions.createPost(postDetails, []);
    }, [actions, post]);

    const cancelPost = useCallback((e: MouseEvent): void => {
        e.preventDefault();

        actions.removePost(post);
    }, [actions, post]);

    return (
        <span className='pending-post-actions'>
            <a
                className='post-retry'
                href='#'
                onClick={retryPost}
            >
                <FormattedMessage
                    id='pending_post_actions.retry'
                    defaultMessage='Retry'
                />
            </a>
            {' - '}
            <a
                className='post-cancel'
                href='#'
                onClick={cancelPost}
            >
                <FormattedMessage
                    id='pending_post_actions.cancel'
                    defaultMessage='Cancel'
                />
            </a>
        </span>
    );
};

export default memo(FailedPostOptions);
