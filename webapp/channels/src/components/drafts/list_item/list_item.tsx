// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import DraftActions from 'components/drafts/draft_actions';
import DraftTitle from 'components/drafts/draft_title';
import Panel from 'components/drafts/panel/panel';
import PanelBody from 'components/drafts/panel/panel_body';
import Header from 'components/drafts/panel/panel_header';

import type {PostDraft} from 'types/store/draft';
import {ScheduledPost} from "@mattermost/types/schedule_post";

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
    return (
        <Panel onClick={handleOnEdit}>
            {({hover}) => (
                <>
                    <Header
                        hover={hover}
                        actions={(
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
                        )}
                        title={(
                            <DraftTitle
                                type={type}
                                channel={channel}
                                userId={user.id}
                            />
                        )}
                        timestamp={kind === 'draft' ? (item as PostDraft).updateAt : (item as ScheduledPost).scheduled_at}
                        remote={isRemote || false}
                    />
                    <PanelBody
                        channelId={channelId}
                        displayName={displayName}
                        fileInfos={item.fileInfos}
                        message={item.message}
                        status={status}
                        priority={showPriority ? item.metadata?.priority : undefined}
                        uploadsInProgress={item.uploadsInProgress}
                        userId={user.id}
                        username={user.username}
                    />
                </>
            )}
        </Panel>
    );
}
