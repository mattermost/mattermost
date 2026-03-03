// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {isPageComment, isPagePost, isPageInlineComment} from 'utils/page_utils';
import {getPageTitle} from 'utils/post_utils';

import type {GlobalState} from 'types/store';

import Button from './common/button';

export function renderThreadPaneHeaderTitle(
    post: Post,
    pagePost: Post | null,
    channel: {display_name: string} | null,
    goToInChannelHandler: () => void,
): JSX.Element {
    if (isPageComment(post) && pagePost) {
        return (
            <span className='separated'>
                {getPageTitle(pagePost, 'Untitled Page')}
            </span>
        );
    }

    if (isPagePost(post)) {
        return (
            <span className='separated'>
                {getPageTitle(post, 'Untitled Page')}
            </span>
        );
    }

    return (
        <Button
            className='separated'
            allowTextOverflow={true}
            onClick={goToInChannelHandler}
        >
            {channel?.display_name}
        </Button>
    );
}

export function shouldHideRootPost(post: Post): boolean {
    return isPagePost(post);
}

export function usePagePostForInlineComment(post: Post | null): Post | null {
    return useSelector((state: GlobalState) => {
        if (!isPageInlineComment(post) || !post?.root_id) {
            return null;
        }
        return getPost(state, post.root_id);
    });
}
