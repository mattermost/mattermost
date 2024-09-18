// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useMemo, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UserThread, UserThreadSynthetic} from '@mattermost/types/threads';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {getPost} from 'mattermost-redux/actions/posts';

import {makeOnSubmit} from 'actions/views/create_comment';
import {removeDraft} from 'actions/views/drafts';
import {selectPost} from 'actions/views/rhs';

import DraftListItem from 'components/drafts/list_item/list_item';

import type {PostDraft} from 'types/store/draft';

type Props = {
    channel?: Channel;
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
        if (thread?.id) {
            return makeOnSubmit(value.channelId, thread.id, '');
        }

        return () => Promise.resolve({data: true});
    }, [value.channelId, thread?.id]);

    const handleOnDelete = useCallback((id: string) => {
        dispatch(removeDraft(id, value.channelId, rootId));
    }, [value.channelId, rootId, dispatch]);

    const handleOnEdit = useCallback(() => {
        dispatch(selectPost({id: rootId, channel_id: value.channelId} as Post));
    }, [value.channelId, dispatch, rootId]);

    const handleOnSend = useCallback(async (id: string) => {
        await dispatch(onSubmit(value));

        handleOnDelete(id);
        handleOnEdit();
    }, [value, onSubmit, dispatch, handleOnDelete, handleOnEdit]);

    if (!thread || !channel) {
        return null;
    }

    return (
        <DraftListItem
            kind='draft'
            type={type}
            itemId={draftId}
            user={user}
            showPriority={false}
            handleOnEdit={handleOnEdit}
            handleOnDelete={handleOnDelete}
            handleOnSend={handleOnSend}
            item={value}
            channelId={channel.id}
            displayName={displayName}
            isRemote={isRemote || false}
            channel={channel}
            status={status}
        />
    );
}

export default memo(ThreadDraft);
