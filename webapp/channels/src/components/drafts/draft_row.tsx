// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import noop from 'lodash/noop';
import React, {memo, useCallback, useMemo, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {getPost as getPostAction} from 'mattermost-redux/actions/posts';
import {Permissions} from 'mattermost-redux/constants';
import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {makeGetThreadOrSynthetic} from 'mattermost-redux/selectors/entities/threads';

import {removeDraft} from 'actions/views/drafts';
import {selectPostById} from 'actions/views/rhs';
import type {Draft} from 'selectors/drafts';
import {getChannelURL} from 'selectors/urls';

import usePriority from 'components/advanced_text_editor/use_priority';
import useSubmit from 'components/advanced_text_editor/use_submit';

import Constants, {StoragePrefixes} from 'utils/constants';

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

const mockLastBlurAt = {current: 0};

function DraftRow({
    draft,
    user,
    status,
    displayName,
    isRemote,
}: Props) {
    const intl = useIntl();

    const rootId = draft.value.rootId;
    const channelId = draft.value.channelId;

    const [serverError, setServerError] = useState<(ServerError & { submittedMessage?: string }) | null>(null);

    const history = useHistory();
    const dispatch = useDispatch();

    const getChannel = useMemo(() => makeGetChannel(), []);
    const getThreadOrSynthetic = useMemo(() => makeGetThreadOrSynthetic(), []);

    const rootPostDeleted = useSelector((state: GlobalState) => {
        if (!rootId) {
            return false;
        }
        const rootPost = getPost(state, rootId);
        return !rootPost || rootPost.delete_at > 0 || rootPost.state === 'DELETED';
    });

    const tooLong = useSelector((state: GlobalState) => {
        const maxPostSize = parseInt(getConfig(state).MaxPostSize || '', 10) || Constants.DEFAULT_CHARACTER_LIMIT;
        return draft.value.message.length > maxPostSize;
    });

    const readOnly = !useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        return channel ? haveIChannelPermission(state, channel.team_id, channel.id, Permissions.CREATE_POST) : false;
    });

    let postError = '';
    if (rootPostDeleted) {
        postError = intl.formatMessage({id: 'drafts.error.post_not_found', defaultMessage: 'Thread not found'});
    } else if (tooLong) {
        postError = intl.formatMessage({id: 'drafts.error.too_long', defaultMessage: 'Message too long'});
    } else if (readOnly) {
        postError = intl.formatMessage({id: 'drafts.error.read_only', defaultMessage: 'Channel is read only'});
    }

    const canSend = !postError;
    const canEdit = !(rootPostDeleted || readOnly);

    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const channelUrl = useSelector((state: GlobalState) => {
        if (!channel) {
            return '';
        }

        const teamId = getCurrentTeamId(state);
        return getChannelURL(state, channel, teamId);
    });

    const goToMessage = useCallback(async () => {
        if (rootId) {
            if (rootPostDeleted) {
                return;
            }
            await dispatch(selectPostById(rootId));
            return;
        }
        history.push(channelUrl);
    }, [channelUrl, dispatch, history, rootId, rootPostDeleted]);

    const {onSubmitCheck: prioritySubmitCheck} = usePriority(draft.value, noop, noop, false);
    const [handleOnSend] = useSubmit(
        draft.value,
        postError,
        channelId,
        rootId,
        serverError,
        mockLastBlurAt,
        noop,
        setServerError,
        noop,
        noop,
        prioritySubmitCheck,
        goToMessage,
        undefined,
        true,
    );

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

    const handleOnDelete = useCallback(() => {
        let key = `${StoragePrefixes.DRAFT}${channelId}`;
        if (rootId) {
            key = `${StoragePrefixes.COMMENT_DRAFT}${rootId}`;
        }
        dispatch(removeDraft(key, channelId, rootId));
    }, [dispatch, channelId, rootId]);

    useEffect(() => {
        if (rootId && !thread?.id) {
            dispatch(getPostAction(rootId));
        }
    }, [thread?.id]);

    if (!channel) {
        return null;
    }

    return (
        <Panel
            onClick={goToMessage}
            hasError={Boolean(postError)}
        >
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
                                onEdit={goToMessage}
                                onSend={handleOnSend}
                                canEdit={canEdit}
                                canSend={canSend}
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
                        error={postError || serverError?.message}
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
                    />
                </>
            )}
        </Panel>
    );
}

export default memo(DraftRow);
