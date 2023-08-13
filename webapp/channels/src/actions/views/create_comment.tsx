// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Post} from '@mattermost/types/posts';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCurrentUserId, getStatusForUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {
    getPost,
    isPostPriorityEnabled,
    makeGetPostIdsForThread,
} from 'mattermost-redux/selectors/entities/posts';
import {getCustomEmojisByName} from 'mattermost-redux/selectors/entities/emojis';
import {
    removeReaction,
    addMessageIntoHistory,
} from 'mattermost-redux/actions/posts';
import {isPostPendingOrFailed} from 'mattermost-redux/utils/post_utils';

import * as PostActions from 'actions/post_actions';
import {executeCommand} from 'actions/command';
import {runMessageWillBePostedHooks, runSlashCommandWillBePostedHooks} from 'actions/hooks';
import {actionOnGlobalItemsWithPrefix} from 'actions/storage';
import {updateDraft, removeDraft} from 'actions/views/drafts';
import EmojiMap from 'utils/emoji_map';

import * as Utils from 'utils/utils';
import {Constants, ModalIdentifiers, StoragePrefixes, UserStatuses} from 'utils/constants';
import {Permissions} from 'mattermost-redux/constants';
import type {PostDraft} from 'types/store/draft';
import type {ActionResult, DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import {containsAtChannel, extractCommand, groupsMentionedInText, hasRequestedPersistentNotifications, isErrorInvalidSlashCommand, isStatusSlashCommand, specialMentionsInText} from 'utils/post_utils';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getConfig, getLicense, isLDAPEnabled as isLDAPEnabledAction} from 'mattermost-redux/selectors/entities/general';
import {isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getAssociatedGroupsForReferenceByMention} from 'mattermost-redux/selectors/entities/groups';
import {Channel} from '@mattermost/types/channels';
import {GroupSource} from '@mattermost/types/groups';
import {getAllChannelStats, getChannel, getChannelMemberCountsByGroup} from 'mattermost-redux/selectors/entities/channels';
import {getChannelTimezones} from 'mattermost-redux/actions/channels';
import NotifyConfirmModal from 'components/notify_confirm_modal';
import PersistNotificationConfirmModal from 'components/persist_notification_confirm_modal';
import {openModal} from './modals';
import ResetStatusModal from 'components/reset_status_modal';
import EditChannelPurposeModal from 'components/edit_channel_purpose_modal';
import {ServerError} from '@mattermost/types/errors';

export function clearCommentDraftUploads() {
    return actionOnGlobalItemsWithPrefix(StoragePrefixes.COMMENT_DRAFT, (_key: string, draft: PostDraft) => {
        if (!draft || !draft.uploadsInProgress || draft.uploadsInProgress.length === 0) {
            return draft;
        }

        return {...draft, uploadsInProgress: []};
    });
}

export function updateCommentDraft(draft: PostDraft, save = false, instant = false) {
    const key = `${StoragePrefixes.COMMENT_DRAFT}${draft.rootId}`;
    return updateDraft(key, draft, save, instant);
}

export function submitPost(channelId: string, rootId: string | undefined, draft: PostDraft) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const currentTeamId = getCurrentTeamId(state);
        const license = getLicense(state);
        const isLDAPEnabled = license?.IsLicensed === 'true' && license?.LDAPGroups === 'true';
        const useChannelMentions = haveIChannelPermission(state, currentTeamId, channelId, Permissions.USE_CHANNEL_MENTIONS);
        const useLDAPGroupMentions = isLDAPEnabled && haveIChannelPermission(state, currentTeamId, channelId, Permissions.USE_GROUP_MENTIONS);
        const useCustomGroupMentions = isCustomGroupsEnabled(state) && haveIChannelPermission(state, currentTeamId, channelId, Permissions.USE_GROUP_MENTIONS);
        const groupsWithAllowReference = useLDAPGroupMentions || useCustomGroupMentions ? getAssociatedGroupsForReferenceByMention(state, currentTeamId, channelId) : null;

        const userId = getCurrentUserId(state);

        const time = Utils.getTimestamp();

        let post = {
            file_ids: [],
            message: draft.message,
            channel_id: channelId,
            root_id: rootId,
            pending_post_id: `${userId}:${time}`,
            user_id: userId,
            create_at: time,
            metadata: {...(draft.metadata || {})},
            props: {...draft.props},
        } as unknown as Post;

        if (!useChannelMentions && containsAtChannel(post.message, {checkAllMentions: true})) {
            post.props.mentionHighlightDisabled = true;
        }

        if (!useLDAPGroupMentions && !useCustomGroupMentions && groupsMentionedInText(post.message, groupsWithAllowReference)) {
            post.props.disable_group_highlight = true;
        }

        const hookResult = await dispatch(runMessageWillBePostedHooks(post));
        if (hookResult.error) {
            return {error: hookResult.error};
        }

        post = hookResult.data;

        return dispatch(PostActions.createPost(post, draft.fileInfos));
    };
}

export function submitReaction(postId: string, action: string, emojiName: string) {
    return (dispatch: DispatchFunc) => {
        if (action === '+') {
            dispatch(PostActions.addReaction(postId, emojiName));
        } else if (action === '-') {
            dispatch(removeReaction(postId, emojiName));
        }
        return {data: true};
    };
}

export function submitCommand(channelId: string, rootId: string | undefined, draft: PostDraft) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();

        const teamId = getCurrentTeamId(state);

        let args = {
            channel_id: channelId,
            team_id: teamId,
            root_id: rootId,
        };

        let {message} = draft;

        const hookResult = await dispatch(runSlashCommandWillBePostedHooks(message, args));
        if (hookResult.error) {
            return {error: hookResult.error};
        } else if (!hookResult.data.message && !hookResult.data.args) {
            // do nothing with an empty return from a hook
            return {};
        }

        message = hookResult.data.message;
        args = hookResult.data.args;

        const {error} = await dispatch(executeCommand(message, args));

        if (error) {
            if (error.sendMessage) {
                return dispatch(submitPost(channelId, rootId, draft));
            }
            return {error};
        }

        return {};
    };
}

function onSubmit(
    draft: PostDraft,
    channelId: string,
    options: {ignoreSlash?: boolean} = {},
    latestPostId: string | undefined,
    preSubmit: () => void,
    onSubmitted: (res: ActionResult, draft: PostDraft) => void,
) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const rootId = draft.rootId;

        const {message} = draft;
        const emojis = getCustomEmojisByName(state);
        const emojiMap = new EmojiMap(emojis);

        preSubmit();
        dispatch(addMessageIntoHistory(message));

        let key: string;
        if (rootId) {
            key = `${StoragePrefixes.COMMENT_DRAFT}${rootId}`;
        } else {
            key = `${StoragePrefixes.DRAFT}${channelId}`;
        }
        dispatch(removeDraft(key, channelId, rootId));
        const restoreDraft = () => {
            updateDraft(key, draft, true);
        };

        const isReaction = Utils.REACTION_PATTERN.exec(message);

        if (isReaction && emojiMap.has(isReaction[2])) {
            if (!latestPostId) {
                restoreDraft();
                onSubmitted({error: new Error('No post to react to')}, draft);
                return {data: true};
            }

            const res = await dispatch(submitReaction(latestPostId, isReaction[1], isReaction[2]));
            if (res.error) {
                restoreDraft();
            }

            onSubmitted(res, draft);
            return {data: true};
        }

        if (message.indexOf('/') === 0 && !options.ignoreSlash) {
            const res = await dispatch(submitCommand(channelId, rootId, draft));
            if (res.error) {
                restoreDraft();
            }

            onSubmitted(res, draft);
            return {data: true};
        }

        const res = await dispatch(submitPost(channelId, rootId, draft));
        if (res.error) {
            restoreDraft();
        }

        onSubmitted(res, draft);
        return {data: true};
    };
}

function makeGetCurrentUsersLatestReply() {
    const getPostIdsInThread = makeGetPostIdsForThread();
    return createSelector(
        'makeGetCurrentUsersLatestReply',
        getCurrentUserId,
        getPostIdsInThread,
        (state) => (id: string) => getPost(state, id),
        (_state, rootId) => rootId,
        (userId, postIds, getPostById, rootId) => {
            let lastPost = null;

            if (!postIds) {
                return lastPost;
            }

            for (const id of postIds) {
                const post = getPostById(id) || {};

                // don't edit webhook posts, deleted posts, or system messages
                if (
                    post.user_id !== userId ||
                    (post.props && post.props.from_webhook) ||
                    post.state === Constants.POST_DELETED ||
                    (post.type && post.type.startsWith(Constants.SYSTEM_MESSAGE_PREFIX)) ||
                    isPostPendingOrFailed(post)
                ) {
                    continue;
                }

                if (rootId) {
                    if (post.root_id === rootId || post.id === rootId) {
                        lastPost = post;
                        break;
                    }
                } else {
                    lastPost = post;
                    break;
                }
            }

            return lastPost;
        },
    );
}

export function makeOnEditLatestPost(rootId: string) {
    const getCurrentUsersLatestPost = makeGetCurrentUsersLatestReply();

    return () => (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();

        const lastPost = getCurrentUsersLatestPost(state, rootId);

        if (!lastPost) {
            return {data: false};
        }

        return dispatch(PostActions.setEditingPost(
            lastPost.id,
            'reply_textbox',
            Utils.localizeMessage('create_comment.commentTitle', 'Comment'),
            true,
        ));
    };
}

type OnSubmitArgs = Parameters<typeof onSubmit>;

export function handleSubmit(draft: PostDraft, preSubmit: () => void, onSubmitted: (res: ActionResult, draft: PostDraft) => void, serverError: SubmitServerError, latestPost: string | undefined) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const config = getConfig(state);
        const message = draft.message;
        const isRHS = Boolean(draft.rootId);

        let ignoreSlash = false;
        if (serverError && isErrorInvalidSlashCommand(serverError) && serverError.submittedMessage === message) {
            ignoreSlash = true;
        }
        const options = {ignoreSlash};

        if (!draft.channelId && !draft.rootId) {
            return {error: new Error('Invalid draft')};
        }

        let channelId = draft.channelId;
        if (!channelId) {
            channelId = getPost(state, draft.rootId)?.channel_id;
        }

        if (!channelId) {
            return {error: new Error('Invalid post id')};
        }

        const channel = getChannel(state, channelId);

        const onSubmitArgs: OnSubmitArgs = [draft, channel.id, options, latestPost, preSubmit, onSubmitted];

        const teamId = channel.team_id || getCurrentTeamId(state);
        const isLDAPEnabled = isLDAPEnabledAction(state);
        const enableConfirmNotificationsToChannel = getConfig(state).EnableConfirmNotificationsToChannel === 'true';
        const useLDAPGroupMentions = isLDAPEnabled && haveIChannelPermission(state, teamId, channel.id, Permissions.USE_GROUP_MENTIONS);
        const useCustomGroupMentions = isCustomGroupsEnabled(state) && haveIChannelPermission(state, channel.team_id, channel.id, Permissions.USE_GROUP_MENTIONS);
        const groupsWithAllowReference = useLDAPGroupMentions || useCustomGroupMentions ? getAssociatedGroupsForReferenceByMention(state, channel.team_id, channel.id) : null;
        const channelMemberCountsByGroup = getChannelMemberCountsByGroup(state, channel.id);

        const specialMentions = specialMentionsInText(message);
        const hasSpecialMentions = Object.values(specialMentions).includes(true);
        let memberNotifyCount = 0;
        let channelTimezoneCount = 0;
        let mentions: string[] = [];

        if (enableConfirmNotificationsToChannel && !hasSpecialMentions && (useLDAPGroupMentions || useCustomGroupMentions)) {
            // Groups mentioned in users text
            const mentionGroups = groupsMentionedInText(message, groupsWithAllowReference);
            if (mentionGroups.length > 0) {
                mentionGroups.
                    forEach((group) => {
                        if (group.source === GroupSource.Ldap && !useLDAPGroupMentions) {
                            return;
                        }
                        if (group.source === GroupSource.Custom && !useCustomGroupMentions) {
                            return;
                        }
                        const mappedValue = channelMemberCountsByGroup[group.id];
                        if (mappedValue && mappedValue.channel_member_count > Constants.NOTIFY_ALL_MEMBERS && mappedValue.channel_member_count > memberNotifyCount) {
                            memberNotifyCount = mappedValue.channel_member_count;
                            channelTimezoneCount = mappedValue.channel_member_timezones_count;
                        }
                        mentions.push(`@${group.name}`);
                    });
                mentions = [...new Set(mentions)];
            }
        }

        const useChannelMentions = haveIChannelPermission(state, teamId, channel.id, Permissions.USE_CHANNEL_MENTIONS);
        const notificationsToChannel = enableConfirmNotificationsToChannel && useChannelMentions;
        const channelMembersCount = getAllChannelStats(state)[channel.id]?.member_count || 1;
        const isTimezoneEnabled = config.ExperimentalTimezone === 'true';

        if (notificationsToChannel && channelMembersCount > Constants.NOTIFY_ALL_MEMBERS && hasSpecialMentions) {
            memberNotifyCount = channelMembersCount - 1;

            for (const k in specialMentions) {
                if (specialMentions[k]) {
                    mentions.push('@' + k);
                }
            }

            if (isTimezoneEnabled) {
                const {data} = await dispatch(getChannelTimezones(channel.id));
                channelTimezoneCount = data ? data.length : 0;
            }
        }

        if (
            !isRHS &&
            isPostPriorityEnabled(state) &&
            hasRequestedPersistentNotifications(draft?.metadata?.priority)
        ) {
            const currentChannelTeammateUsername = getUser(state, channel.teammate_id || '')?.username;
            dispatch(showPersistNotificationModal(message, specialMentions, channel.type, currentChannelTeammateUsername, onSubmitArgs));
            return {data: {shouldClear: false}};
        }

        if (memberNotifyCount > 0) {
            dispatch(showNotifyAllModal(mentions, channelTimezoneCount, memberNotifyCount, onSubmitArgs));
            return {data: {shouldClear: false}};
        }

        const userIsOutOfOffice = getStatusForUserId(state, getCurrentUserId(state)) === UserStatuses.OUT_OF_OFFICE;
        const status = extractCommand(message);
        if (userIsOutOfOffice && isStatusSlashCommand(status)) {
            dispatch(showResetStatusModal(status));
            return {data: {shouldClear: true}};
        }

        if (message.trimEnd() === '/header') {
            dispatch(showEditChannelHeaderModal(channel));
            return {data: {shouldClear: true}};
        }

        const isDirectOrGroup = channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL;
        if (!isDirectOrGroup && message.trimEnd() === '/purpose') {
            dispatch(showEditChannelPurposeModal(channel));
            return {data: {shouldClear: true}};
        }

        if (!shouldAllowSubmit(draft, serverError)) {
            return {error: new Error('cannot submit an empty or errored draft')};
        }

        if (draft.uploadsInProgress.length > 0) {
            return {error: new Error('cannot submit a draft with pending uploads')};
        }

        dispatch(onSubmit(...onSubmitArgs));

        return {data: {submitting: true}};
    };
}

export type SubmitServerError = (ServerError & {submittedMessage?: string | undefined}) | null

function shouldAllowSubmit(draft: PostDraft, serverError: SubmitServerError) {
    if (draft.message.trim().length !== 0 || draft.fileInfos.length !== 0) {
        return true;
    }

    return isErrorInvalidSlashCommand(serverError);
}

function showEditChannelHeaderModal(channel: Channel) {
    return (dispatch: DispatchFunc) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelPurposeModal,
            dialogProps: {channel},
        }));
        return {data: true};
    };
}

function showEditChannelPurposeModal(channel: Channel) {
    return (dispatch: DispatchFunc) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_PURPOSE,
            dialogType: EditChannelPurposeModal,
            dialogProps: {channel},
        }));
        return {data: true};
    };
}

function showResetStatusModal(newStatus: string) {
    return (dispatch: DispatchFunc) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.RESET_STATUS,
            dialogType: ResetStatusModal,
            dialogProps: {newStatus},
        }));
        return {data: true};
    };
}

function showNotifyAllModal(
    mentions: string[],
    channelTimezoneCount: number,
    memberNotifyCount: number,
    doSubmitArgs: OnSubmitArgs,
) {
    return (dispatch: DispatchFunc) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.NOTIFY_CONFIRM_MODAL,
            dialogType: NotifyConfirmModal,
            dialogProps: {
                mentions,
                channelTimezoneCount,
                memberNotifyCount,
                onConfirm: () => dispatch(onSubmit(...doSubmitArgs)),
            }}));
        return {data: true};
    };
}

function showPersistNotificationModal(
    message: string,
    specialMentions: {[key: string]: boolean}, channelType: Channel['type'],
    currentChannelTeammateUsername: string,
    doSubmitArgs: OnSubmitArgs,
) {
    return (dispatch: DispatchFunc) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.PERSIST_NOTIFICATION_CONFIRM_MODAL,
            dialogType: PersistNotificationConfirmModal,
            dialogProps: {
                currentChannelTeammateUsername,
                specialMentions,
                channelType,
                message,
                onConfirm: () => dispatch(onSubmit(...doSubmitArgs)),
            },
        }));
        return {data: true};
    };
}
