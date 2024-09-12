// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {FileInfo} from '@mattermost/types/files';
import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import DraftActions from 'components/drafts/draft_actions';
import ScheduledPostActions from 'components/drafts/draft_actions/schedule_post_actions/scheduled_post_actions';
import DraftTitle from 'components/drafts/draft_title';
import Panel from 'components/drafts/panel/panel';
import PanelBody from 'components/drafts/panel/panel_body';
import Header from 'components/drafts/panel/panel_header';

import './style.scss';

import type {PostDraft} from 'types/store/draft';

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

    const scheduledPostActions = useMemo(() => (
        <ScheduledPostActions/>
    ), []);

    let timestamp: number;
    let fileInfos: FileInfo[];
    let uploadsInProgress: string[];
    let actions: React.ReactNode;
    let panelClassName = '';

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
