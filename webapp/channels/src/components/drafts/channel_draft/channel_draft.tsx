// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {useDispatch} from 'react-redux';
import {useHistory} from 'react-router-dom';

import type {Channel} from '@mattermost/types/channels';
import type {Post, PostMetadata} from '@mattermost/types/posts';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {createPost} from 'actions/post_actions';
import {removeDraft} from 'actions/views/drafts';
import {openModal} from 'actions/views/modals';

import PersistNotificationConfirmModal from 'components/persist_notification_confirm_modal';

import {ModalIdentifiers} from 'utils/constants';
import {hasRequestedPersistentNotifications, specialMentionsInText} from 'utils/post_utils';

import type {PostDraft} from 'types/store/draft';

import DraftActions from '../draft_actions';
import DraftTitle from '../draft_title';
import Panel from '../panel/panel';
import PanelBody from '../panel/panel_body';
import Header from '../panel/panel_header';

type Props = {
    channel?: Channel;
    channelUrl: string;
    displayName: string;
    draftId: string;
    id: Channel['id'];
    postPriorityEnabled: boolean;
    status: UserStatus['status'];
    type: 'channel' | 'thread';
    user: UserProfile;
    value: PostDraft;
    isRemote?: boolean;
}

function ChannelDraft({
    channel,
    channelUrl,
    displayName,
    draftId,
    postPriorityEnabled,
    status,
    type,
    user,
    value,
    isRemote,
    id: channelId,
}: Props) {
    const dispatch = useDispatch();
    const history = useHistory();

    const handleOnEdit = useCallback(() => {
        history.push(channelUrl);
    }, [history, channelUrl]);

    const handleOnDelete = useCallback((id: string) => {
        dispatch(removeDraft(id, channelId));
    }, [dispatch, channelId]);

    const doSubmit = useCallback((id: string, post: Post) => {
        dispatch(createPost(post, value.fileInfos));
        dispatch(removeDraft(id, channelId));
        history.push(channelUrl);
    }, [dispatch, history, value.fileInfos, channelId, channelUrl]);

    const showPersistNotificationModal = useCallback((id: string, post: Post) => {
        if (!channel) {
            return;
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.PERSIST_NOTIFICATION_CONFIRM_MODAL,
            dialogType: PersistNotificationConfirmModal,
            dialogProps: {
                message: post.message,
                channelType: channel.type,
                specialMentions: specialMentionsInText(post.message),
                onConfirm: () => doSubmit(id, post),
            },
        }));
    }, [channel, dispatch, doSubmit]);

    const handleOnSend = useCallback(async (id: string) => {
        const post = {} as Post;
        post.file_ids = [];
        post.message = value.message;
        post.props = value.props || {};
        post.user_id = user.id;
        post.channel_id = value.channelId;
        post.metadata = (value.metadata || {}) as PostMetadata;

        if (post.message.trim().length === 0 && value.fileInfos.length === 0) {
            return;
        }

        if (postPriorityEnabled && hasRequestedPersistentNotifications(value?.metadata?.priority)) {
            showPersistNotificationModal(id, post);
            return;
        }
        doSubmit(id, post);
    }, [doSubmit, postPriorityEnabled, value, user.id, showPersistNotificationModal]);

    if (!channel) {
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
                                channelType={channel.type}
                                channelName={channel.name}
                                userId={user.id}
                                draftId={draftId}
                                onDelete={handleOnDelete}
                                onEdit={handleOnEdit}
                                onSend={handleOnSend}
                            />
                        )}
                        title={(
                            <DraftTitle
                                channel={channel}
                                type={type}
                                userId={user.id}
                            />
                        )}
                        timestamp={value.updateAt}
                        remote={isRemote || false}
                    />
                    <PanelBody
                        channelId={channelId}
                        displayName={displayName}
                        fileInfos={value.fileInfos}
                        message={value.message}
                        status={status}
                        priority={value.metadata?.priority}
                        uploadsInProgress={value.uploadsInProgress}
                        userId={user.id}
                        username={user.username}
                    />
                </>
            )}
        </Panel>
    );
}

export default memo(ChannelDraft);
