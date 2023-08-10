// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import * as PostListUtils from 'mattermost-redux/utils/post_list';

import PostComponent from 'components/post';
import CombinedUserActivityPost from 'components/post_view/combined_user_activity_post';
import DateSeparator from 'components/post_view/date_separator';
import NewMessageSeparator from 'components/post_view/new_message_separator/new_message_separator';

import {Locations} from 'utils/constants';

import Reply from './reply';

import type {Post} from '@mattermost/types/posts';
import type {Props as TimestampProps} from 'components/timestamp/timestamp';

type Props = {
    a11yIndex: number;
    currentUserId: string;
    isRootPost: boolean;
    isLastPost: boolean;
    listId: string;
    onCardClick: (post: Post) => void;
    previousPostId: string;
    timestampProps?: Partial<TimestampProps>;
};

function noop() {}
function ThreadViewerRow({
    a11yIndex,
    currentUserId,
    isRootPost,
    isLastPost,
    listId,
    onCardClick,
    previousPostId,
    timestampProps,
}: Props) {
    switch (true) {
    case PostListUtils.isDateLine(listId): {
        const date = PostListUtils.getDateForDateLine(listId);
        return (
            <DateSeparator
                key={date}
                date={date}
            />
        );
    }

    case PostListUtils.isStartOfNewMessages(listId):
        return <NewMessageSeparator separatorId={listId}/>;

    case isRootPost:
        return (
            <PostComponent
                postId={listId}
                isLastPost={isLastPost}
                handleCardClick={onCardClick}
                timestampProps={timestampProps}
                location={Locations.RHS_ROOT}
            />
        );
    case PostListUtils.isCombinedUserActivityPost(listId): {
        return (
            <CombinedUserActivityPost
                location={Locations.CENTER}
                combinedId={listId}
                previousPostId={previousPostId}
                isLastPost={isLastPost}
                shouldHighlight={false}
                togglePostMenu={noop}
            />
        );
    }
    default:
        return (
            <Reply
                a11yIndex={a11yIndex}
                currentUserId={currentUserId}
                id={listId}
                isLastPost={isLastPost}
                onCardClick={onCardClick}
                previousPostId={previousPostId}
                timestampProps={timestampProps}
            />
        );
    }
}

export default memo(ThreadViewerRow);
