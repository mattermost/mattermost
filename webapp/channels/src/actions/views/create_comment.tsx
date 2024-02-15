// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {
    addMessageIntoHistory,
} from 'mattermost-redux/actions/posts';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCustomEmojisByName} from 'mattermost-redux/selectors/entities/emojis';
import {
    getPost,
    makeGetPostIdsForThread,
} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, ActionFuncAsync} from 'mattermost-redux/types/actions';
import {isPostPendingOrFailed} from 'mattermost-redux/utils/post_utils';

import {executeCommand} from 'actions/command';
import {runMessageWillBePostedHooks, runSlashCommandWillBePostedHooks} from 'actions/hooks';
import * as PostActions from 'actions/post_actions';
import {actionOnGlobalItemsWithPrefix} from 'actions/storage';
import {updateDraft, removeDraft} from 'actions/views/drafts';

import {Constants, StoragePrefixes} from 'utils/constants';
import EmojiMap from 'utils/emoji_map';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

export function clearCommentDraftUploads() {
    return actionOnGlobalItemsWithPrefix(StoragePrefixes.COMMENT_DRAFT, (_key: string, draft: PostDraft) => {
        if (!draft || !draft.uploadsInProgress || draft.uploadsInProgress.length === 0) {
            return draft;
        }

        return {...draft, uploadsInProgress: []};
    });
}

// Temporarily store draft manually in localStorage since the current version of redux-persist
// we're on will not save the draft quickly enough on page unload.
export function updateCommentDraft(rootId: string, draft?: PostDraft, save = false) {
    const key = `${StoragePrefixes.COMMENT_DRAFT}${rootId}`;
    return updateDraft(key, draft ?? null, rootId, save);
}

export function submitPost(channelId: string, rootId: string, draft: PostDraft): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();

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
            metadata: {},
            props: {...draft.props},
        } as unknown as Post;

        const hookResult = await dispatch(runMessageWillBePostedHooks(post));
        if (hookResult.error) {
            return {error: hookResult.error};
        }

        post = hookResult.data;

        return dispatch(PostActions.createPost(post, draft.fileInfos));
    };
}

export function submitCommand(channelId: string, rootId: string, draft: PostDraft): ActionFuncAsync<unknown, GlobalState> {
    return async (dispatch, getState) => {
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
        } else if (!hookResult.data!.message && !hookResult.data!.args) {
            // do nothing with an empty return from a hook
            return {};
        }

        message = hookResult.data!.message;
        args = hookResult.data!.args;

        const {error} = await dispatch(executeCommand(message, args));

        if (error) {
            if (error.sendMessage) {
                return dispatch(submitPost(channelId, rootId, draft));
            }
            throw (error);
        }

        return {};
    };
}

export function makeOnSubmit(channelId: string, rootId: string, latestPostId: string): (draft: PostDraft, options?: {ignoreSlash?: boolean}) => ActionFuncAsync<boolean, GlobalState> {
    return (draft, options = {}) => async (dispatch, getState) => {
        const {message} = draft;

        dispatch(addMessageIntoHistory(message));

        const key = `${StoragePrefixes.COMMENT_DRAFT}${rootId}`;
        dispatch(removeDraft(key, channelId, rootId));

        const isReaction = Utils.REACTION_PATTERN.exec(message);

        const emojis = getCustomEmojisByName(getState());
        const emojiMap = new EmojiMap(emojis);

        if (isReaction && emojiMap.has(isReaction[2])) {
            dispatch(PostActions.submitReaction(latestPostId, isReaction[1], isReaction[2]));
        } else if (message.indexOf('/') === 0 && !options.ignoreSlash) {
            try {
                await dispatch(submitCommand(channelId, rootId, draft));
            } catch (err) {
                dispatch(updateCommentDraft(rootId, draft, true));
                throw err;
            }
        } else {
            dispatch(submitPost(channelId, rootId, draft));
        }
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

export function makeOnEditLatestPost(rootId: string): () => ActionFunc<boolean> {
    const getCurrentUsersLatestPost = makeGetCurrentUsersLatestReply();

    return () => (dispatch, getState) => {
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
