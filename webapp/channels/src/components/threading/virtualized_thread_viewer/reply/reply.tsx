// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import PostComponent from 'components/post';

import {Locations} from 'utils/constants';

import type {Post} from '@mattermost/types/posts';
import type {Props as TimestampProps} from 'components/timestamp/timestamp';

type Props = {
    a11yIndex: number;
    currentUserId: string;
    isLastPost: boolean;
    onCardClick: (post: Post) => void;
    post: Post;
    previousPostId: string;
    timestampProps?: Partial<TimestampProps>;
    id?: Post['id'];
}

function Reply({
    a11yIndex,
    isLastPost,
    onCardClick,
    post,
    previousPostId,
    timestampProps,
}: Props) {
    return (
        <PostComponent
            a11yIndex={a11yIndex}
            handleCardClick={onCardClick}
            isLastPost={isLastPost}
            post={post}
            previousPostId={previousPostId}
            timestampProps={timestampProps}
            location={Locations.RHS_COMMENT}
        />
    );
}

export default memo(Reply);
