// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useMemo, useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import type {ServerError} from '@mattermost/types/errors';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {getPost as getPostAction} from 'mattermost-redux/actions/posts';
import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {makeGetThreadOrSynthetic} from 'mattermost-redux/selectors/entities/threads';

import {removeDraft} from 'actions/views/drafts';
import {selectPost} from 'actions/views/rhs';
import type {Draft} from 'selectors/drafts';
import {getChannelURL} from 'selectors/urls';

import usePriority from 'components/advanced_text_editor/use_priority';
import useSubmit from 'components/advanced_text_editor/use_submit';

import type {GlobalState} from 'types/store';

import DraftActions from './draft_actions';
import DraftTitle from './draft_title';
import Panel from './panel/panel';
import PanelBody from './panel/panel_body';
import Header from './panel/panel_header';

type Props = {
    user: UserProfile;
    status: UserStatus['status'];
    displayName: string;
    draft: Draft;
    isRemote?: boolean;
}

const noOp = () => true;
const mockLastBlurAt = {current: 0};

function DraftRow({
    draft,
    user,
    status,
    displayName,
    isRemote,
}: Props) {
    const rootId = draft.value.rootId;
    const channelId = draft.value.channelId;

    const [postError, setPostError] = useState<React.ReactNode>(null);
    const [serverError, setServerError] = useState<(ServerError & { submittedMessage?: string }) | null>(null);

    const history = useHistory();
    const dispatch = useDispatch();

    const getChannel = useMemo(() => makeGetChannel(), []);
    const getThreadOrSynthetic = useMemo(() => makeGetThreadOrSynthetic(), []);

    const {onSubmitCheck: prioritySubmitCheck} = usePriority(draft.value, noOp, noOp, false);
    const [handleOnSend, errorClass] = useSubmit(
        draft.value,
        postError,
        channelId,
        rootId,
        serverError,
        mockLastBlurAt,
        noOp,
        setServerError,
        setPostError,
        noOp,
        noOp,
        prioritySubmitCheck,
        undefined,
        true,
    );

    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const channelUrl = useSelector((state: GlobalState) => {
        if (!channel) {
            return '';
        }

        const teamId = getCurrentTeamId(state);
        return getChannelURL(state, channel, teamId);
    });

    const thread = useSelector((state: GlobalState) => {
        if (!rootId) {
            return undefined;
        }
        const post = getPost(state, rootId);
        if (!post) {
            return undefined;
        }

        return getThreadOrSynthetic(state, post);
    });

    const handleOnEdit = useCallback(() => {
        if (rootId) {
            dispatch(selectPost({id: rootId, channel_id: channelId} as Post));
            return;
        }
        history.push(channelUrl);
    }, [channelId, channelUrl, dispatch, history, rootId]);

    const handleOnDelete = useCallback(() => {
        dispatch(removeDraft(draft.id, channelId, rootId));
    }, [dispatch, draft.id, channelId, rootId]);

    useEffect(() => {
        if (rootId && !thread?.id) {
            dispatch(getPostAction(rootId));
        }
    }, [thread?.id]);

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
                                channelName={channel.name}
                                channelType={channel.type}
                                userId={user.id}
                                onDelete={handleOnDelete}
                                onEdit={handleOnEdit}
                                onSend={handleOnSend}
                            />
                        )}
                        title={(
                            <DraftTitle
                                type={draft.type}
                                channel={channel}
                                userId={user.id}
                            />
                        )}
                        timestamp={draft.value.updateAt}
                        remote={isRemote || false}
                    />
                    <PanelBody
                        channelId={channel.id}
                        displayName={displayName}
                        fileInfos={draft.value.fileInfos}
                        message={draft.value.message}
                        status={status}
                        uploadsInProgress={draft.value.uploadsInProgress}
                        userId={user.id}
                        username={user.username}
                        error={postError || serverError}
                        errorClass={errorClass || ''}
                    />
                </>
            )}
        </Panel>
    );
}

export default memo(DraftRow);
