// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import noop from 'lodash/noop';
import React, {memo, useCallback, useMemo, useEffect, useState, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import type {ServerError} from '@mattermost/types/errors';
import type {FileInfo} from '@mattermost/types/files';
import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {getPost as getPostAction} from 'mattermost-redux/actions/posts';
import {deleteScheduledPost, updateScheduledPost} from 'mattermost-redux/actions/scheduled_posts';
import {Permissions} from 'mattermost-redux/constants';
import {isDeactivatedDirectChannel, makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {makeGetThreadOrSynthetic} from 'mattermost-redux/selectors/entities/threads';

import type {SubmitPostReturnType} from 'actions/views/create_comment';
import {removeDraft} from 'actions/views/drafts';
import {selectPostById} from 'actions/views/rhs';
import {getConnectionId} from 'selectors/general';
import {getChannelURL} from 'selectors/urls';

import usePriority from 'components/advanced_text_editor/use_priority';
import useSubmit from 'components/advanced_text_editor/use_submit';
import {useScrollOnRender} from 'components/common/hooks/use_scroll_on_render';
import ScheduledPostActions from 'components/drafts/draft_actions/schedule_post_actions/scheduled_post_actions';
import PlaceholderScheduledPostsTitle
    from 'components/drafts/placeholder_scheduled_post_title/placeholder_scheduled_posts_title';
import EditScheduledPost from 'components/edit_scheduled_post';

import Constants, {StoragePrefixes} from 'utils/constants';
import {copyToClipboard} from 'utils/utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';
import {scheduledPostToPostDraft} from 'types/store/draft';

import DraftActions from './draft_actions';
import DraftTitle from './draft_title';
import Panel from './panel/panel';
import PanelBody from './panel/panel_body';
import Header from './panel/panel_header';
import {getErrorStringFromCode} from './utils';

type Props = {
    user: UserProfile;
    status: UserStatus['status'];
    displayName: string;
    item: PostDraft | ScheduledPost;
    isRemote?: boolean;
    scrollIntoView?: boolean;
    containerClassName?: string;
    dataTestId?: string;
    dataPostId?: string;
}

const mockLastBlurAt = {current: 0};

function DraftRow({
    item,
    user,
    status,
    displayName,
    isRemote,
    scrollIntoView,
    containerClassName,
}: Props) {
    const [isEditing, setIsEditing] = useState(false);

    const isScheduledPost = 'scheduled_at' in item;
    const intl = useIntl();

    const rootId = ('rootId' in item) ? item.rootId : item.root_id;
    const channelId = ('channelId' in item) ? item.channelId : item.channel_id;

    const [serverError, setServerError] = useState<(ServerError & { submittedMessage?: string }) | null>(null);

    const history = useHistory();
    const dispatch = useDispatch();

    const getChannelSelector = useMemo(() => makeGetChannel(), []);
    const channel = useSelector((state: GlobalState) => getChannelSelector(state, channelId));

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
        return item.message.length > maxPostSize;
    });

    const readOnly = !useSelector((state: GlobalState) => {
        return channel ? haveIChannelPermission(state, channel.team_id, channel.id, Permissions.CREATE_POST) : false;
    });

    const connectionId = useSelector(getConnectionId);

    const isChannelArchived = Boolean(channel?.delete_at);
    const isDeactivatedDM = useSelector((state: GlobalState) => isDeactivatedDirectChannel(state, channelId));

    let postError = '';

    if (isScheduledPost) {
        // This is applicable only for scheduled post.
        if (item.error_code) {
            postError = getErrorStringFromCode(intl, item.error_code);
        } else if (isChannelArchived || isDeactivatedDM) {
            postError = getErrorStringFromCode(intl, 'channel_archived');
        }
    } else if (rootPostDeleted) {
        postError = intl.formatMessage({id: 'drafts.error.post_not_found', defaultMessage: 'Thread not found'});
    } else if (tooLong) {
        postError = intl.formatMessage({id: 'drafts.error.too_long', defaultMessage: 'Message too long'});
    } else if (readOnly) {
        postError = intl.formatMessage({id: 'drafts.error.read_only', defaultMessage: 'Channel is read only'});
    }

    const canSend = !postError;
    const canEdit = !(rootPostDeleted || readOnly);

    const channelUrl = useSelector((state: GlobalState) => {
        if (!channel) {
            return '';
        }
        const teamId = getCurrentTeamId(state);
        return getChannelURL(state, channel, teamId);
    });

    const goToMessage = useCallback(async () => {
        if (isEditing) {
            return;
        }

        if (rootId) {
            if (rootPostDeleted) {
                return;
            }
            await dispatch(selectPostById(rootId));
            return;
        }
        history.push(channelUrl);
    }, [channelUrl, dispatch, history, rootId, rootPostDeleted, isEditing]);

    const isBeingScheduled = useRef(false);
    const isScheduledPostBeingSent = useRef(false);

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

    const afterSubmit = useCallback((response: SubmitPostReturnType) => {
        // if draft was being scheduled, delete the draft after it's been scheduled
        if (isBeingScheduled.current && response.created && !response.error) {
            handleOnDelete();
            isBeingScheduled.current = false;
        }

        // if scheduled posts was being sent, delete the scheduled post after it's been sent
        if (isScheduledPostBeingSent.current && response.created && !response.error) {
            const scheduledPost = item as ScheduledPost;
            dispatch(deleteScheduledPost(scheduledPost.user_id, scheduledPost.id, connectionId));
            isScheduledPostBeingSent.current = false;
        }
    }, [connectionId, dispatch, handleOnDelete, item]);

    // TODO LOL verify the types and handled it better
    const {onSubmitCheck: prioritySubmitCheck} = usePriority(item as any, noop, noop, false);
    const [handleOnSend] = useSubmit(
        item as any,
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
        afterSubmit,
        true,
    );

    const onScheduleDraft = useCallback(async (scheduledAt: number): Promise<{error?: string}> => {
        isBeingScheduled.current = true;
        await handleOnSend(item as PostDraft, {scheduled_at: scheduledAt});
        return Promise.resolve({});
    }, [item, handleOnSend]);

    const draftActions = useMemo(() => {
        if (!channel) {
            return null;
        }
        return (
            <DraftActions
                channelDisplayName={channel.display_name}
                channelName={channel.name}
                channelType={channel.type}
                channelId={channel.id}
                userId={user.id}
                onDelete={handleOnDelete}
                onEdit={goToMessage}
                onSend={handleOnSend}
                canEdit={canEdit}
                canSend={canSend}
                onSchedule={onScheduleDraft}
            />
        );
    }, [
        canEdit,
        canSend,
        channel,
        goToMessage,
        handleOnDelete,
        handleOnSend,
        user.id,
        onScheduleDraft,
    ]);

    const handleCancelEdit = useCallback(() => {
        setIsEditing(false);
    }, []);

    const handleSchedulePostOnReschedule = useCallback(async (updatedScheduledAtTime: number) => {
        handleCancelEdit();

        const updatedScheduledPost: ScheduledPost = {
            ...(item as ScheduledPost),
            scheduled_at: updatedScheduledAtTime,
        };

        const result = await dispatch(updateScheduledPost(updatedScheduledPost, connectionId));
        return {
            error: result.error?.message,
        };
    }, [connectionId, dispatch, item, handleCancelEdit]);

    const handleSchedulePostOnDelete = useCallback(async () => {
        handleCancelEdit();

        const scheduledPost = item as ScheduledPost;
        const result = await dispatch(deleteScheduledPost(scheduledPost.user_id, scheduledPost.id, connectionId));
        return {
            error: result.error?.message,
        };
    }, [item, dispatch, connectionId, handleCancelEdit]);

    const handleSchedulePostEdit = useCallback(() => {
        setIsEditing((isEditing) => !isEditing);
    }, []);

    const handleCopyText = useCallback(() => {
        copyToClipboard(item.message);
    }, [item]);

    const handleScheduledPostOnSend = useCallback(() => {
        handleCancelEdit();

        isScheduledPostBeingSent.current = true;
        const postDraft = scheduledPostToPostDraft(item as ScheduledPost);
        handleOnSend(postDraft, undefined, {keepDraft: true, ignorePostError: true});
        return Promise.resolve({});
    }, [handleOnSend, item, handleCancelEdit]);

    const scheduledPostActions = useMemo(() => {
        return (
            <ScheduledPostActions
                scheduledPost={item as ScheduledPost}
                channel={channel}
                onReschedule={handleSchedulePostOnReschedule}
                onDelete={handleSchedulePostOnDelete}
                onSend={handleScheduledPostOnSend}
                onEdit={handleSchedulePostEdit}
                onCopyText={handleCopyText}
            />
        );
    }, [
        channel,
        handleSchedulePostOnDelete,
        handleSchedulePostOnReschedule,
        handleScheduledPostOnSend,
        handleSchedulePostEdit,
        handleCopyText,
        item,
    ]);

    useEffect(() => {
        if (rootId && !thread?.id) {
            dispatch(getPostAction(rootId));
        }
    }, [thread?.id, rootId]);

    const alertRef = useScrollOnRender();

    if (!channel && !isScheduledPost) {
        return null;
    }

    let timestamp: number;
    let fileInfos: FileInfo[];
    let uploadsInProgress: string[];
    let actions: React.ReactNode;

    if (isScheduledPost) {
        timestamp = item.scheduled_at;
        fileInfos = item.metadata?.files || [];
        uploadsInProgress = [];
        actions = scheduledPostActions;
    } else {
        timestamp = item.updateAt;
        fileInfos = item.fileInfos;
        uploadsInProgress = item.uploadsInProgress;
        actions = draftActions;
    }

    let title: React.ReactNode;
    if (channel) {
        title = (
            <DraftTitle
                type={(rootId ? 'thread' : 'channel')}
                channel={channel}
                userId={user.id}
            />
        );
    } else {
        title = (
            <PlaceholderScheduledPostsTitle
                type={(rootId ? 'thread' : 'channel')}
            />
        );
    }

    const kind = isScheduledPost ? 'scheduledPost' : 'draft';

    return (
        <Panel
            dataTestId={`${kind}View`}
            dataPostId={(item as ScheduledPost).id}
            onClick={goToMessage}
            hasError={Boolean(postError)}
            innerRef={scrollIntoView ? alertRef : undefined}
            isHighlighted={scrollIntoView}
            className={containerClassName}
            ariaLabel={isScheduledPost ? intl.formatMessage({
                id: 'drafts.draft_row.aria_label.scheduled_post',
                defaultMessage: 'scheduled post in {channelName}',
            }, {
                channelName: channel?.display_name,
            }) : intl.formatMessage({
                id: 'drafts.draft_row.aria_label.draft',
                defaultMessage: 'draft in {channelName}',
            }, {
                channelName: channel?.display_name,
            })}
        >
            <Header
                kind={kind}
                actions={actions}
                title={title}
                timestamp={timestamp}
                remote={isRemote || false}
                error={postError || serverError?.message}
            />
            {isEditing && (
                <EditScheduledPost
                    scheduledPost={item as ScheduledPost}
                    onCancel={handleCancelEdit}
                    afterSave={handleCancelEdit}
                    onDeleteScheduledPost={handleSchedulePostOnDelete}
                />
            )}
            {!isEditing && (
                <PanelBody
                    channelId={channel?.id}
                    displayName={displayName}
                    fileInfos={fileInfos}
                    message={item.message}
                    status={status}
                    priority={rootId ? undefined : item.metadata?.priority}
                    uploadsInProgress={uploadsInProgress}
                    userId={user.id}
                    username={user.username}
                />
            )}
        </Panel>
    );
}

export default memo(DraftRow);
