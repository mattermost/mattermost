// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import type {Post} from '@mattermost/types/posts';

import * as PostListUtils from 'mattermost-redux/utils/post_list';

import PostComponent from 'components/post';
import CombinedUserActivityPost from 'components/post_view/combined_user_activity_post';
import DateSeparator from 'components/post_view/date_separator';
import NewMessageSeparator from 'components/post_view/new_message_separator/new_message_separator';
import RootPostDivider from 'components/root_post_divider/root_post_divider';
import type {Props as TimestampProps} from 'components/timestamp/timestamp';

import {Locations} from 'utils/constants';

import type {NewMessagesSeparatorActionComponent} from 'types/store/plugins';

import Reply from './reply';

type Props = {
    a11yIndex: number;
    currentUserId: string;
    isRootPost: boolean;
    isDeletedPost: boolean;
    isLastPost: boolean;
    listId: string;
    onCardClick: (post: Post) => void;
    previousPostId: string;
    timestampProps?: Partial<TimestampProps>;
    threadId: string;
    newMessagesSeparatorActions: NewMessagesSeparatorActionComponent[];
};

function noop() {}
function ThreadViewerRow({
    a11yIndex,
    currentUserId,
    isRootPost,
    isDeletedPost,
    isLastPost,
    listId,
    onCardClick,
    previousPostId,
    timestampProps,
    threadId,
    newMessagesSeparatorActions,
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
        return (
            <NewMessageSeparator
                separatorId={listId}
                threadId={threadId}
                newMessagesSeparatorActions={newMessagesSeparatorActions}
            />
        );

    case isRootPost:
        return (
            <>
                <PostComponent
                    postId={listId}
                    isLastPost={isLastPost}
                    handleCardClick={onCardClick}
                    timestampProps={timestampProps}
                    location={Locations.RHS_ROOT}
                />
                {!isDeletedPost && <RootPostDivider postId={listId}/>}
            </>
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
