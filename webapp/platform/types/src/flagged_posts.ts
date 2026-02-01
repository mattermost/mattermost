// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type FlaggedPostsState = {
    postIds: string[];
    page: number;
    perPage: number;
    isEnd: boolean;
    isLoading: boolean;
    isLoadingMore: boolean;
};
