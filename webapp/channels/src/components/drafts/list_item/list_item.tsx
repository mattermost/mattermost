// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {FileInfo} from '@mattermost/types/files';
import type {ScheduledPost, ScheduledPostErrorCode} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {deleteScheduledPost, updateScheduledPost} from 'mattermost-redux/actions/scheduled_posts';

import {getConnectionId} from 'selectors/general';

import DraftActions from 'components/drafts/draft_actions';
import ScheduledPostActions from 'components/drafts/draft_actions/schedule_post_actions/scheduled_post_actions';
import DraftTitle from 'components/drafts/draft_title';
import Panel from 'components/drafts/panel/panel';
import PanelBody from 'components/drafts/panel/panel_body';
import Header from 'components/drafts/panel/panel_header';

import type {PostDraft} from 'types/store/draft';

import './style.scss';

type Props = {
    kind: 'draft' | 'scheduledPost';
    type: 'channel' | 'thread';
    itemId: string;
    channel: Channel;
    user: UserProfile;
    showPriority: boolean;
    handleOnEdit: () => void;
    handleOnDelete: (id: string) => void;
    handleOnSend: (id: string) => void;
    item: PostDraft | ScheduledPost;
    channelId: string;
    displayName: string;
    isRemote?: boolean;
    status: UserStatus['status'];
}

export default function DraftListItem({
    kind,
    handleOnEdit,
    channel,
    user,
    itemId,
    handleOnDelete,
    handleOnSend,
    type,
    item,
    isRemote,
    channelId,
    displayName,
    showPriority,
    status,
}: Props) {
    const dispatch = useDispatch();
    const connectionId = useSelector(getConnectionId);

    const draftActions = useMemo(() => (
        <DraftActions
            channelDisplayName={channel.display_name}
            channelType={channel.type}
            channelName={channel.name}
            userId={user.id}
            itemId={itemId}
            onDelete={handleOnDelete}
            onEdit={handleOnEdit}
            onSend={handleOnSend}
        />
    ), [channel.display_name, channel.name, channel.type, handleOnDelete, handleOnEdit, handleOnSend, itemId, user.id]);

    const handleSchedulePostOnReschedule = useCallback(async (updatedScheduledAtTime: number) => {
        const updatedScheduledPost: ScheduledPost = {
            ...(item as ScheduledPost),
            scheduled_at: updatedScheduledAtTime,
        };

        const result = await dispatch(updateScheduledPost(updatedScheduledPost, connectionId));
        return {
            error: result.error?.message,
        };
    }, [connectionId, dispatch, item]);

    const handleSchedulePostOnDelete = useCallback(async () => {
        const scheduledPostId = (item as ScheduledPost).id;
        const result = await dispatch(deleteScheduledPost(scheduledPostId, connectionId));
        return {
            error: result.error?.message,
        };
    }, [item, dispatch, connectionId]);

    const scheduledPostActions = useMemo(() => (
        <ScheduledPostActions
            scheduledPost={item as ScheduledPost}
            channelDisplayName={channel.display_name}
            onReschedule={handleSchedulePostOnReschedule}
            onDelete={handleSchedulePostOnDelete}
            onSend={() => {}}
        />
    ), [channel.display_name, item]);

    let timestamp: number;
    let fileInfos: FileInfo[];
    let uploadsInProgress: string[];
    let actions: React.ReactNode;
    let panelClassName = '';
    let errorCode: ScheduledPostErrorCode | undefined;

    if (kind === 'draft') {
        const draft = item as PostDraft;

        timestamp = draft.updateAt;
        fileInfos = draft.fileInfos;
        uploadsInProgress = draft.uploadsInProgress;
        actions = draftActions;
    } else {
        const scheduledPost = item as ScheduledPost;

        timestamp = scheduledPost.scheduled_at;
        fileInfos = scheduledPost.metadata?.files || [];
        uploadsInProgress = [];
        actions = scheduledPostActions;

        if (scheduledPost.error_code) {
            panelClassName = 'scheduled_post_error';
            errorCode = scheduledPost.error_code;
        }
    }

    return (
        <Panel
            onClick={handleOnEdit}
            className={panelClassName}
        >
            {({hover}) => (
                <>
                    <Header
                        kind={kind}
                        hover={hover}
                        actions={actions}
                        title={(
                            <DraftTitle
                                type={type}
                                channel={channel}
                                userId={user.id}
                            />
                        )}
                        timestamp={timestamp}
                        remote={isRemote || false}
                        errorCode={errorCode}
                    />
                    <PanelBody
                        channelId={channelId}
                        displayName={displayName}
                        fileInfos={fileInfos}
                        message={item.message}
                        status={status}
                        priority={showPriority ? item.metadata?.priority : undefined}
                        uploadsInProgress={uploadsInProgress}
                        userId={user.id}
                        username={user.username}
                    />
                </>
            )}
        </Panel>
    );
}
