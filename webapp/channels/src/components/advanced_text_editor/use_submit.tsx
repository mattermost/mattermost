// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';
import {useCallback, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {SchedulingInfo} from '@mattermost/types/schedule_post';

import {FileTypes} from 'mattermost-redux/action_types';
import {getChannelTimezones} from 'mattermost-redux/actions/channels';
import {Permissions} from 'mattermost-redux/constants';
import {getChannel, getAllChannelStats} from 'mattermost-redux/selectors/entities/channels';
import {getFilesIdsForPost} from 'mattermost-redux/selectors/entities/files';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentUserId, getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

import {unsetEditingPost, type CreatePostOptions} from 'actions/post_actions';
import {scrollPostListToBottom} from 'actions/views/channel';
import type {OnSubmitOptions, SubmitPostReturnType} from 'actions/views/create_comment';
import {onSubmit} from 'actions/views/create_comment';
import {openModal} from 'actions/views/modals';
import {editPost} from 'actions/views/posts';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import EditChannelPurposeModal from 'components/edit_channel_purpose_modal';
import NotifyConfirmModal from 'components/notify_confirm_modal';
import PostDeletedModal from 'components/post_deleted_modal';
import ResetStatusModal from 'components/reset_status_modal';

import Constants, {ModalIdentifiers, UserStatuses} from 'utils/constants';
import {isErrorInvalidSlashCommand, isServerError, specialMentionsInText} from 'utils/post_utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';
import {isPostDraftEmpty} from 'types/store/draft';

import useGroups from './use_groups';

function getStatusFromSlashCommand(message: string) {
    const tokens = message.split(' ');
    const command = tokens[0] || '';
    if (command[0] !== '/') {
        return '';
    }
    const status = command.substring(1);
    if (status === 'online' || status === 'away' || status === 'dnd' || status === 'offline') {
        return status;
    }

    return '';
}

const useSubmit = (
    draft: PostDraft,
    postError: React.ReactNode,
    channelId: string,
    rootId: string,
    serverError: (ServerError & { submittedMessage?: string }) | null,
    lastBlurAt: React.MutableRefObject<number>,
    focusTextbox: (forceFocust?: boolean) => void,
    setServerError: (err: (ServerError & { submittedMessage?: string }) | null) => void,
    setShowPreview: (showPreview: boolean) => void,
    handleDraftChange: (draft: PostDraft, options?: {instant?: boolean; show?: boolean}) => void,
    prioritySubmitCheck: (onConfirm: () => void) => boolean,
    afterOptimisticSubmit?: () => void,
    afterSubmit?: (response: SubmitPostReturnType) => void,
    skipCommands?: boolean,
    isInEditMode?: boolean,
    postId?: string,
): [
        (submittingDraft?: PostDraft, schedulingInfo?: SchedulingInfo, options?: CreatePostOptions) => void,
        string | null,
    ] => {
    const getGroupMentions = useGroups(channelId, draft.message);

    const dispatch = useDispatch();

    const postFileIds = useSelector((state: GlobalState) => getFilesIdsForPost(state, postId || ''));

    const isDraftSubmitting = useRef(false);
    const [errorClass, setErrorClass] = useState<string | null>(null);
    const isDirectOrGroup = useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        if (!channel) {
            return false;
        }
        return channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL;
    });

    const channel = useSelector((state: GlobalState) => {
        return getChannel(state, channelId);
    });

    const isRootDeleted = useSelector((state: GlobalState) => {
        if (!rootId) {
            return false;
        }
        const post = getPost(state, rootId);
        if (!post || post.delete_at || post.state === 'DELETED') {
            return true;
        }

        return false;
    });

    const enableConfirmNotificationsToChannel = useSelector((state: GlobalState) => getConfig(state).EnableConfirmNotificationsToChannel === 'true');
    const channelMembersCount = useSelector((state: GlobalState) => getAllChannelStats(state)[channelId]?.member_count ?? 1);
    const userIsOutOfOffice = useSelector((state: GlobalState) => {
        const currentUserId = getCurrentUserId(state);
        return getStatusForUserId(state, currentUserId) === UserStatuses.OUT_OF_OFFICE;
    });
    const useChannelMentions = useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        if (!channel) {
            return false;
        }
        return haveIChannelPermission(state, channel.team_id, channel.id, Permissions.USE_CHANNEL_MENTIONS);
    });

    const showPostDeletedModal = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.POST_DELETED_MODAL,
            dialogType: PostDeletedModal,
        }));
    }, [dispatch]);

    const doSubmit = useCallback(async (submittingDraft: PostDraft = draft, schedulingInfo?: SchedulingInfo, createPostOptions?: CreatePostOptions) => {
        if (submittingDraft.uploadsInProgress.length > 0) {
            isDraftSubmitting.current = false;
            return;
        }

        if (postError && !createPostOptions?.ignorePostError) {
            setErrorClass('animation--highlight');
            setTimeout(() => {
                setErrorClass(null);
            }, Constants.ANIMATION_TIMEOUT);
            isDraftSubmitting.current = false;
            return;
        }

        if (isPostDraftEmpty(draft)) {
            isDraftSubmitting.current = false;
            return;
        }

        if (!schedulingInfo) {
            if (isRootDeleted) {
                showPostDeletedModal();
                isDraftSubmitting.current = false;
                return;
            }
        }

        if (serverError && !isErrorInvalidSlashCommand(serverError)) {
            isDraftSubmitting.current = false;
            return;
        }

        const fasterThanHumanWillClick = 150;
        const forceFocus = Date.now() - lastBlurAt.current < fasterThanHumanWillClick;
        focusTextbox(forceFocus);

        setServerError(null);

        const ignoreSlash = skipCommands || (isErrorInvalidSlashCommand(serverError) && serverError?.submittedMessage === submittingDraft.message);
        const options: OnSubmitOptions = {
            ignoreSlash,
            afterSubmit,
            afterOptimisticSubmit,
            keepDraft: createPostOptions?.keepDraft,
        };

        try {
            let response;
            if (isInEditMode) {
                response = await dispatch(editPost(submittingDraft));
                handleFileChange(submittingDraft);
            } else {
                response = await dispatch(onSubmit(submittingDraft, options, schedulingInfo));
            }
            if (response?.error) {
                throw response.error;
            }

            setServerError(null);
            handleDraftChange({
                message: '',
                fileInfos: [],
                uploadsInProgress: [],
                createAt: 0,
                updateAt: 0,
                channelId,
                rootId,
            }, {instant: true});
        } catch (err: unknown) {
            if (isServerError(err)) {
                if (isErrorInvalidSlashCommand(err)) {
                    handleDraftChange(submittingDraft, {instant: true});
                }
                setServerError({
                    ...err,
                    submittedMessage: submittingDraft.message,
                });
            } else {
                setServerError(err as any);
            }
            isDraftSubmitting.current = false;
            return;
        }

        if (!rootId && !schedulingInfo) {
            dispatch(scrollPostListToBottom());
        }

        if (isInEditMode) {
            dispatch(unsetEditingPost());
        }

        isDraftSubmitting.current = false;
    }, [
        dispatch,
        draft,
        postError,
        isRootDeleted,
        serverError,
        lastBlurAt,
        focusTextbox,
        setServerError,
        skipCommands,
        afterSubmit,
        afterOptimisticSubmit,
        rootId,
        showPostDeletedModal,
        handleDraftChange,
        channelId,
        isInEditMode,
    ]);

    const handleFileChange = useCallback((submittingDraft: PostDraft) => {
        // sets the updated data for file IDs by post ID part
        dispatch({
            type: FileTypes.RECEIVED_FILES_FOR_POST,
            data: submittingDraft.fileInfos,
            postId,
        });

        // removes the data for the deleted files from store
        const deletedFileIds = postFileIds.filter((id: string) => !submittingDraft.fileInfos.find((file) => file.id === id));
        if (deletedFileIds) {
            dispatch({
                type: FileTypes.REMOVED_FILE,
                data: {
                    fileIds: deletedFileIds,
                },
            });
        }
    }, [dispatch, postFileIds, postId]);

    const setUpdatedFileIds = useCallback((draft: PostDraft) => {
        // new object creation is needed here to support sending a draft with files.
        // In case of draft, the PostDraft object is fetched from the redux store, which is immutable.
        // When user clicks 'Send Now' in drafts list, it will otherwise try to set a field on an immutable object.
        // Hence, creating a new object here.
        return {
            ...draft,
            file_ids: draft.fileInfos.map((fileInfo) => fileInfo.id),
        };
    }, []);

    const showNotifyAllModal = useCallback((mentions: string[], channelTimezoneCount: number, memberNotifyCount: number, onConfirm: () => void) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.NOTIFY_CONFIRM_MODAL,
            dialogType: NotifyConfirmModal,
            dialogProps: {
                mentions,
                channelTimezoneCount,
                memberNotifyCount,
                onConfirm,
            },
        }));
    }, [dispatch]);

    const handleSubmit = useCallback(async (submittingDraftParam = draft, schedulingInfo?: SchedulingInfo, options?: CreatePostOptions) => {
        if (!channel) {
            return;
        }

        if (isDraftSubmitting.current) {
            return;
        }

        const submittingDraft = setUpdatedFileIds(submittingDraftParam);
        setShowPreview(false);
        isDraftSubmitting.current = true;

        const notificationsToChannel = enableConfirmNotificationsToChannel && useChannelMentions;
        let memberNotifyCount = 0;
        let channelTimezoneCount = 0;
        let mentions: string[] = [];

        const specialMentions = specialMentionsInText(submittingDraft.message);
        const hasSpecialMentions = Object.values(specialMentions).includes(true);

        if (enableConfirmNotificationsToChannel && !hasSpecialMentions) {
            ({memberNotifyCount, channelTimezoneCount, mentions} = getGroupMentions(submittingDraft.message));
        }

        if (notificationsToChannel && channelMembersCount > Constants.NOTIFY_ALL_MEMBERS && hasSpecialMentions) {
            memberNotifyCount = channelMembersCount - 1;

            for (const k in specialMentions) {
                if (specialMentions[k]) {
                    mentions.push('@' + k);
                }
            }

            const {data} = await dispatch(getChannelTimezones(channelId));
            channelTimezoneCount = data ? data.length : 0;
        }

        const onConfirm = () => doSubmit(submittingDraft, schedulingInfo);
        if (prioritySubmitCheck(onConfirm)) {
            isDraftSubmitting.current = false;
            return;
        }

        if (memberNotifyCount > 0) {
            showNotifyAllModal(mentions, channelTimezoneCount, memberNotifyCount, onConfirm);
            isDraftSubmitting.current = false;
            return;
        }

        if (!skipCommands && !schedulingInfo) {
            const status = getStatusFromSlashCommand(submittingDraft.message);
            if (userIsOutOfOffice && status) {
                const resetStatusModalData = {
                    modalId: ModalIdentifiers.RESET_STATUS,
                    dialogType: ResetStatusModal,
                    dialogProps: {newStatus: status},
                };

                dispatch(openModal(resetStatusModalData));

                handleDraftChange({
                    ...submittingDraft,
                    message: '',
                });
                isDraftSubmitting.current = false;
                return;
            }

            if (submittingDraft.message.trimEnd() === '/header') {
                const editChannelHeaderModalData = {
                    modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
                    dialogType: EditChannelHeaderModal,
                    dialogProps: {channel},
                };

                dispatch(openModal(editChannelHeaderModalData));

                handleDraftChange({
                    ...submittingDraft,
                    message: '',
                });
                isDraftSubmitting.current = false;
                return;
            }

            if (!isDirectOrGroup && submittingDraft.message.trimEnd() === '/purpose') {
                const editChannelPurposeModalData = {
                    modalId: ModalIdentifiers.EDIT_CHANNEL_PURPOSE,
                    dialogType: EditChannelPurposeModal,
                    dialogProps: {channel},
                };

                dispatch(openModal(editChannelPurposeModalData));

                handleDraftChange({
                    ...submittingDraft,
                    message: '',
                });
                isDraftSubmitting.current = false;
                return;
            }
        }

        await doSubmit(submittingDraft, schedulingInfo, options);
    }, [
        doSubmit,
        draft,
        isDirectOrGroup,
        channel,
        channelId,
        channelMembersCount,
        dispatch,
        enableConfirmNotificationsToChannel,
        skipCommands,
        handleDraftChange,
        showNotifyAllModal,
        useChannelMentions,
        userIsOutOfOffice,
        getGroupMentions,
        setShowPreview,
        prioritySubmitCheck,
    ]);

    return [handleSubmit, errorClass];
};

export default useSubmit;
