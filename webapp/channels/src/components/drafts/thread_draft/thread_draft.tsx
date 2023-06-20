// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useMemo, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import type {UserThread, UserThreadSynthetic} from '@mattermost/types/threads';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile, UserStatus} from '@mattermost/types/users';
import type {Post} from '@mattermost/types/posts';

import type {PostDraft} from 'types/store/draft';

import {getPost} from 'mattermost-redux/actions/posts';

import {selectPost} from 'actions/views/rhs';
import {removeDraft} from 'actions/views/drafts';
import {makeOnSubmit} from 'actions/views/create_comment';

import DraftTitle from '../draft_title';
import DraftActions from '../draft_actions';
import Panel from '../panel/panel';
import Header from '../panel/panel_header';
import PanelBody from '../panel/panel_body';

type Props = {
    channel: Channel;
    displayName: string;
    draftId: string;
    rootId: UserThread['id'] | UserThreadSynthetic['id'];
    status: UserStatus['status'];
    thread?: UserThread | UserThreadSynthetic;
    type: 'channel' | 'thread';
    user: UserProfile;
    value: PostDraft;
    isRemote?: boolean;
}

function ThreadDraft({
    channel,
    displayName,
    draftId,
    rootId,
    status,
    thread,
    type,
    user,
    value,
    isRemote,
}: Props) {
    const dispatch = useDispatch();

    useEffect(() => {
        if (!thread?.id) {
            dispatch(getPost(rootId));
        }
    }, [thread?.id]);

    const onSubmit = useMemo(() => {
        if (thread) {
            return makeOnSubmit(channel.id, thread.id, '');
        }

        return () => Promise.resolve({data: true});
    }, [channel.id, thread?.id]);

    const handleOnDelete = useCallback((id: string) => {
        dispatch(removeDraft(id, channel.id, rootId));
    }, [channel.id, rootId]);

    const handleOnEdit = useCallback(() => {
        dispatch(selectPost({id: rootId, channel_id: channel.id} as Post));
    }, [channel]);

    const handleOnSend = useCallback(async (id: string) => {
        await dispatch(onSubmit(value));

        handleOnDelete(id);
        handleOnEdit();
    }, [value, onSubmit]);

    if (!thread) {
        return null;
    }

    return (
        <Panel onClick={handleOnEdit}>
            {({hover}) => (
                <>
                    <Header
                        hover={hover}
                        actions={(
                            <DraftActions
                                channelDisplayName={channel.display_name}
                                channelName={channel.name}
                                channelType={channel.type}
                                userId={user.id}
                                draftId={draftId}
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
                        timestamp={value.updateAt}
                        remote={isRemote || false}
                    />
                    <PanelBody
                        channelId={channel.id}
                        displayName={displayName}
                        fileInfos={value.fileInfos}
                        message={value.message}
                        status={status}
                        uploadsInProgress={value.uploadsInProgress}
                        userId={user.id}
                        username={user.username}
                    />
                </>
            )}
        </Panel>
    );
}

export default memo(ThreadDraft);
