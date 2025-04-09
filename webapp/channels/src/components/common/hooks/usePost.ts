// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {getPostsByIdsBatched} from 'mattermost-redux/actions/posts';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {makeUseEntity} from './useEntity';

export const usePost = makeUseEntity<Post>({
    name: 'usePost',
    fetch: (postId: string) => getPostsByIdsBatched([postId]),
    selector: getPost,
});
