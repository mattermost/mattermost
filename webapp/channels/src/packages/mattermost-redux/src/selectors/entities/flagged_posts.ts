// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getAllPosts} from 'mattermost-redux/selectors/entities/posts';

export function getFlaggedPostIds(state: GlobalState): string[] {
    return state.entities.flaggedPosts.postIds;
}

export function getFlaggedPostsPage(state: GlobalState): number {
    return state.entities.flaggedPosts.page;
}

export function getIsFlaggedPostsEnd(state: GlobalState): boolean {
    return state.entities.flaggedPosts.isEnd;
}

export function getIsFlaggedPostsLoading(state: GlobalState): boolean {
    return state.entities.flaggedPosts.isLoading;
}

export function getIsFlaggedPostsLoadingMore(state: GlobalState): boolean {
    return state.entities.flaggedPosts.isLoadingMore;
}

export const getFlaggedPosts = createSelector(
    'getFlaggedPosts',
    getFlaggedPostIds,
    getAllPosts,
    (postIds, allPosts): Post[] => {
        return postIds.map((id) => allPosts[id]).filter(Boolean);
    },
);
