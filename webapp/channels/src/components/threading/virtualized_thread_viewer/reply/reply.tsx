// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import type {Post} from '@mattermost/types/posts';

import PostComponent from 'components/post';

import {Locations} from 'utils/constants';

type Props = {
    a11yIndex: number;
    isLastPost: boolean;
    onCardClick: (post: Post) => void;
    post: Post;
    previousPostId: string;
    isChannelAutotranslated: boolean;
};

function Reply({
    a11yIndex,
    isLastPost,
    onCardClick,
    post,
    previousPostId,
    isChannelAutotranslated,
}: Props) {
    return (
        <PostComponent
            a11yIndex={a11yIndex}
            handleCardClick={onCardClick}
            isLastPost={isLastPost}
            post={post}
            previousPostId={previousPostId}
            location={Locations.RHS_COMMENT}
            isChannelAutotranslated={isChannelAutotranslated}
        />
    );
}

export default memo(Reply);
