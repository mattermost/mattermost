// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import * as PostListUtils from 'mattermost-redux/utils/post_list';

import PostComponent from 'components/post';
import CombinedUserActivityPost from 'components/post_view/combined_user_activity_post';
import DateSeparator from 'components/post_view/date_separator';
import NewMessageSeparator from 'components/post_view/new_message_separator/new_message_separator';
import RhsPostPropertiesPanel from 'components/rhs_post_properties_panel';
import RootPostDivider from 'components/root_post_divider/root_post_divider';
import type {Props as TimestampProps} from 'components/timestamp/timestamp';

import {Locations} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {NewMessagesSeparatorActionComponent} from 'types/store/plugins';

import Reply from './reply';

type Props = {
    a11yIndex: number;
    isRootPost: boolean;
    isDeletedPost: boolean;
    isLastPost: boolean;
    listId: string;
    onCardClick: (post: Post) => void;
    previousPostId: string;
    timestampProps?: Partial<TimestampProps>;
    threadId: string;
    newMessagesSeparatorActions: NewMessagesSeparatorActionComponent[];
    isChannelAutotranslated: boolean;
};

function noop() {}

function RootPostRow({
    listId,
    isLastPost,
    isDeletedPost,
    onCardClick,
    timestampProps,
    isChannelAutotranslated,
}: {
    listId: string;
    isLastPost: boolean;
    isDeletedPost: boolean;
    onCardClick: (post: Post) => void;
    timestampProps?: Partial<TimestampProps>;
    isChannelAutotranslated: boolean;
}) {
    const channelId = useSelector((state: GlobalState) => getPost(state, listId)?.channel_id ?? '');
    const integratedBoardsEnabled = useSelector(
        (state: GlobalState) => getFeatureFlagValue(state, 'IntegratedBoards') === 'true',
    );

    return (
        <>
            <PostComponent
                postId={listId}
                isLastPost={isLastPost}
                handleCardClick={onCardClick}
                timestampProps={timestampProps}
                location={Locations.RHS_ROOT}
                isChannelAutotranslated={isChannelAutotranslated}
            />
            <RhsPostPropertiesPanel
                postId={listId}
                channelId={channelId}
            />
            {!isDeletedPost && (
                <RootPostDivider
                    postId={listId}
                    sectionHeading={integratedBoardsEnabled}
                />
            )}
        </>
    );
}

function ThreadViewerRow({
    a11yIndex,
    isRootPost,
    isDeletedPost,
    isLastPost,
    listId,
    onCardClick,
    previousPostId,
    timestampProps,
    threadId,
    newMessagesSeparatorActions,
    isChannelAutotranslated,
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
            <RootPostRow
                listId={listId}
                isLastPost={isLastPost}
                isDeletedPost={isDeletedPost}
                onCardClick={onCardClick}
                timestampProps={timestampProps}
                isChannelAutotranslated={isChannelAutotranslated}
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
                isChannelAutotranslated={false}
            />
        );
    }
    default:
        return (
            <Reply
                a11yIndex={a11yIndex}
                id={listId}
                isLastPost={isLastPost}
                onCardClick={onCardClick}
                previousPostId={previousPostId}
                timestampProps={timestampProps}
                isChannelAutotranslated={isChannelAutotranslated}
            />
        );
    }
}

export default memo(ThreadViewerRow);
