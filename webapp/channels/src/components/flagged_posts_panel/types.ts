// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

export type StateProps = {
    posts: Post[];
    isLoading: boolean;
    isLoadingMore: boolean;
    isEnd: boolean;
};

export type DispatchProps = {
    actions: {
        getMoreFlaggedPosts: () => void;
    };
};

export type Props = StateProps & DispatchProps;
