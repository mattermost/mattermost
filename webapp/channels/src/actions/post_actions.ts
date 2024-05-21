// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';
import type {GroupChannel} from '@mattermost/types/groups';
import type {Post} from '@mattermost/types/posts';

import {SearchTypes} from 'mattermost-redux/action_types';
import {getMyChannelMember} from 'mattermost-redux/actions/channels';
import * as PostActions from 'mattermost-redux/actions/posts';
import * as ThreadActions from 'mattermost-redux/actions/threads';
import {getChannel, getMyChannelMember as getMyChannelMemberSelector} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import * as PostSelectors from 'mattermost-redux/selectors/entities/posts';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import type {DispatchFunc, ActionFunc, ActionFuncAsync, ThunkActionFunc} from 'mattermost-redux/types/actions';
import {canEditPost, comparePosts} from 'mattermost-redux/utils/post_utils';

import {addRecentEmoji, addRecentEmojis} from 'actions/emoji_actions';
import * as StorageActions from 'actions/storage';
import {loadNewDMIfNeeded, loadNewGMIfNeeded} from 'actions/user_actions';
import {removeDraft} from 'actions/views/drafts';
import {closeModal, openModal} from 'actions/views/modals';
import * as RhsActions from 'actions/views/rhs';
import {manuallyMarkThreadAsUnread} from 'actions/views/threads';
import {isEmbedVisible, isInlineImageVisible} from 'selectors/posts';
import {getSelectedPostId, getSelectedPostCardId, getRhsState} from 'selectors/rhs';
import {getGlobalItem} from 'selectors/storage';

import ReactionLimitReachedModal from 'components/reaction_limit_reached_modal';

import {
    ActionTypes,
    Constants,
    ModalIdentifiers,
    RHSStates,
    StoragePrefixes,
} from 'utils/constants';
import {matchEmoticons} from 'utils/emoticons';
import {makeGetIsReactionAlreadyAddedToPost, makeGetUniqueEmojiNameReactionsForPost} from 'utils/post_utils';
import * as UserAgent from 'utils/user_agent';

import type {GlobalState} from 'types/store';

import {completePostReceive} from './new_post';
import type {NewPostMessageProps} from './new_post';

export function handleNewPost(post: Post, msg?: {data?: NewPostMessageProps & GroupChannel}): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        let websocketMessageProps = {};
        const state = getState();
        if (msg) {
            websocketMessageProps = msg.data!;
        }

        const myChannelMember = getMyChannelMemberSelector(state, post.channel_id);
        const myChannelMemberDoesntExist = !myChannelMember || (Object.keys(myChannelMember).length === 0 && myChannelMember.constructor === Object);

        if (myChannelMemberDoesntExist) {
            await dispatch(getMyChannelMember(post.channel_id));
        }

        dispatch(completePostReceive(post, websocketMessageProps as NewPostMessageProps, myChannelMemberDoesntExist));

        if (msg && msg.data) {
            if (msg.data.channel_type === Constants.DM_CHANNEL) {
                dispatch(loadNewDMIfNeeded(post.channel_id));
            } else if (msg.data.channel_type === Constants.GM_CHANNEL) {
                dispatch(loadNewGMIfNeeded(post.channel_id));
            }
        }

        return {data: true};
    };
}

const getPostsForIds = PostSelectors.makeGetPostsForIds();

export function flagPost(postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        await dispatch(PostActions.flagPost(postId));
        const state = getState() as GlobalState;
        const rhsState = getRhsState(state);

        if (rhsState === RHSStates.FLAG) {
            dispatch(addPostToSearchResults(postId));
        }

        return {data: true};
    };
}

export function unflagPost(postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        await dispatch(PostActions.unflagPost(postId));
        const state = getState() as GlobalState;
        const rhsState = getRhsState(state);

        if (rhsState === RHSStates.FLAG) {
            removePostFromSearchResults(postId, state, dispatch);
        }

        return {data: true};
    };
}

export function createPost(post: Post, files: FileInfo[]): ActionFuncAsync {
    return async (dispatch) => {
        // parse message and emit emoji event
        const emojis = matchEmoticons(post.message);
        if (emojis) {
            const trimmedEmojis = emojis.map((emoji) => emoji.substring(1, emoji.length - 1));
            dispatch(addRecentEmojis(trimmedEmojis));
        }

        let result;
        if (UserAgent.isIosClassic()) {
            result = await dispatch(PostActions.createPostImmediately(post, files));
        } else {
            result = await dispatch(PostActions.createPost(post, files));
        }

        if (post.root_id) {
            dispatch(storeCommentDraft(post.root_id, null));
        } else {
            dispatch(storeDraft(post.channel_id, null));
        }

        return result;
    };
}

function storeDraft(channelId: string, draft: null): ActionFunc {
    return (dispatch) => {
        dispatch(StorageActions.setGlobalItem('draft_' + channelId, draft));
        return {data: true};
    };
}

function storeCommentDraft(rootPostId: string, draft: null): ActionFunc {
    return (dispatch) => {
        dispatch(StorageActions.setGlobalItem('comment_draft_' + rootPostId, draft));
        return {data: true};
    };
}

export function submitReaction(postId: string, action: string, emojiName: string): ActionFunc<unknown, GlobalState> {
    return (dispatch, getState) => {
        const state = getState() as GlobalState;
        const getIsReactionAlreadyAddedToPost = makeGetIsReactionAlreadyAddedToPost();

        const isReactionAlreadyAddedToPost = getIsReactionAlreadyAddedToPost(state, postId, emojiName);

        if (action === '+' && !isReactionAlreadyAddedToPost) {
            dispatch(addReaction(postId, emojiName));
        } else if (action === '-' && isReactionAlreadyAddedToPost) {
            dispatch(PostActions.removeReaction(postId, emojiName));
        }
        return {data: true};
    };
}

export function toggleReaction(postId: string, emojiName: string): ActionFuncAsync<unknown, GlobalState> {
    return async (dispatch, getState) => {
        const state = getState();
        const getIsReactionAlreadyAddedToPost = makeGetIsReactionAlreadyAddedToPost();

        const isReactionAlreadyAddedToPost = getIsReactionAlreadyAddedToPost(state, postId, emojiName);

        if (isReactionAlreadyAddedToPost) {
            return dispatch(PostActions.removeReaction(postId, emojiName));
        }
        return dispatch(addReaction(postId, emojiName));
    };
}

export function addReaction(postId: string, emojiName: string): ActionFunc {
    const getUniqueEmojiNameReactionsForPost = makeGetUniqueEmojiNameReactionsForPost();
    return (dispatch, getState) => {
        const state = getState() as GlobalState;
        const config = getConfig(state);
        const uniqueEmojiNames = getUniqueEmojiNameReactionsForPost(state, postId) ?? [];

        // If we're adding a new reaction but we're already at or over the limit, stop
        if (uniqueEmojiNames.length >= Number(config.UniqueEmojiReactionLimitPerPost) && !uniqueEmojiNames.some((name) => name === emojiName)) {
            dispatch(openModal({
                modalId: ModalIdentifiers.REACTION_LIMIT_REACHED,
                dialogType: ReactionLimitReachedModal,
                dialogProps: {
                    isAdmin: isCurrentUserSystemAdmin(state),
                    onExited: () => closeModal(ModalIdentifiers.REACTION_LIMIT_REACHED),
                },
            }));
            return {data: false};
        }

        dispatch(PostActions.addReaction(postId, emojiName));
        dispatch(addRecentEmoji(emojiName));
        return {data: true};
    };
}

export function searchForTerm(term: string): ActionFunc<boolean, GlobalState> {
    return (dispatch) => {
        dispatch(RhsActions.updateSearchTerms(term));
        dispatch(RhsActions.showSearchResults());
        return {data: true};
    };
}

function addPostToSearchResults(postId: string): ActionFunc {
    return (dispatch, getState) => {
        const state = getState();
        const results = state.entities.search.results;
        const index = results.indexOf(postId);
        if (index === -1) {
            const newPost = PostSelectors.getPost(state, postId);
            const posts = getPostsForIds(state, results).reduce((acc, post) => {
                acc[post.id] = post;
                return acc;
            }, {} as Record<string, Post>);
            posts[newPost.id] = newPost;

            const newResults = [...results, postId];
            newResults.sort((a, b) => comparePosts(posts[a], posts[b]));

            dispatch({
                type: SearchTypes.RECEIVED_SEARCH_POSTS,
                data: {posts, order: newResults},
            });
        }
        return {data: true};
    };
}

function removePostFromSearchResults(postId: string, state: GlobalState, dispatch: DispatchFunc) {
    let results = state.entities.search.results;
    const index = results.indexOf(postId);
    if (index > -1) {
        results = [...results];
        results.splice(index, 1);

        const posts = getPostsForIds(state, results);

        dispatch({
            type: SearchTypes.RECEIVED_SEARCH_POSTS,
            data: {posts, order: results},
        });
    }
}

export function pinPost(postId: string): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        await dispatch(PostActions.pinPost(postId));
        const state = getState();
        const rhsState = getRhsState(state);

        if (rhsState === RHSStates.PIN) {
            dispatch(addPostToSearchResults(postId));
        }
        return {data: true};
    };
}

export function unpinPost(postId: string): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        await dispatch(PostActions.unpinPost(postId));
        const state = getState();
        const rhsState = getRhsState(state);

        if (rhsState === RHSStates.PIN) {
            removePostFromSearchResults(postId, state, dispatch);
        }
        return {data: true};
    };
}

export function setEditingPost(postId = '', refocusId = '', title = '', isRHS = false): ActionFunc<boolean> {
    return (dispatch, getState) => {
        const state = getState();
        const post = PostSelectors.getPost(state, postId);

        if (!post || post.pending_post_id === postId) {
            return {data: false};
        }

        const config = state.entities.general.config;
        const license = state.entities.general.license;
        const userId = getCurrentUserId(state);
        const channel = getChannel(state, post.channel_id);
        const teamId = channel?.team_id || '';

        const canEditNow = canEditPost(state, config, license, teamId, post.channel_id, userId, post);

        // Only show the modal if we can edit the post now, but allow it to be hidden at any time

        if (canEditNow) {
            dispatch({
                type: ActionTypes.TOGGLE_EDITING_POST,
                data: {postId, refocusId, title, isRHS, show: true},
            });
        }

        return {data: canEditNow};
    };
}

export function unsetEditingPost() {
    return {
        type: ActionTypes.TOGGLE_EDITING_POST,
        data: {
            show: false,
        },
    };
}

export function markPostAsUnread(post: Post, location?: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const userId = getCurrentUserId(state);
        const currentTeamId = getCurrentTeamId(state);

        // if CRT:ON and this is from within ThreadViewer (e.g. post dot-menu), mark the thread as unread and followed
        if (isCollapsedThreadsEnabled(state) && (location === 'RHS_ROOT' || location === 'RHS_COMMENT')) {
            const threadId = post.root_id || post.id;
            ThreadActions.handleFollowChanged(dispatch, threadId, currentTeamId, true);
            dispatch(manuallyMarkThreadAsUnread(threadId, post.create_at - 1));
            await dispatch(ThreadActions.markThreadAsUnread(userId, currentTeamId, threadId, post.id));
        } else {
            // use normal channel unread system
            await dispatch(PostActions.setUnreadPost(userId, post.id));
        }

        return {data: true};
    };
}

export function markMostRecentPostInChannelAsUnread(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        let state = getState();
        let postId = PostSelectors.getMostRecentPostIdInChannel(state, channelId);
        if (!postId) {
            await dispatch(PostActions.getPosts(channelId));
            state = getState();
            postId = PostSelectors.getMostRecentPostIdInChannel(state, channelId);
        }
        if (postId) {
            const lastPost = PostSelectors.getPost(state, postId);
            dispatch(markPostAsUnread(lastPost, 'CENTER'));
        }
        return {data: true};
    };
}

// Action called by DeletePostModal when the post is deleted
export function deleteAndRemovePost(post: Post): ActionFuncAsync<boolean, GlobalState> {
    return async (dispatch, getState) => {
        const {error} = await dispatch(PostActions.deletePost(post));
        if (error) {
            return {error};
        }

        if (post.id === getSelectedPostId(getState())) {
            dispatch({
                type: ActionTypes.SELECT_POST,
                postId: '',
                channelId: '',
                timestamp: 0,
            });
        }

        if (post.id === getSelectedPostCardId(getState())) {
            dispatch({
                type: ActionTypes.SELECT_POST_CARD,
                postId: '',
                channelId: '',
            });
        }

        if (post.root_id === '') {
            const key = StoragePrefixes.COMMENT_DRAFT + post.id;
            if (getGlobalItem(getState(), key, null)) {
                dispatch(removeDraft(key, post.channel_id, post.id));
            }
        }

        dispatch(PostActions.removePost(post));

        return {data: true};
    };
}

export function toggleEmbedVisibility(postId: string): ThunkActionFunc<void, GlobalState> {
    return (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const visible = isEmbedVisible(state, postId);

        dispatch(StorageActions.setGlobalItem(StoragePrefixes.EMBED_VISIBLE + currentUserId + '_' + postId, !visible));
    };
}

export function resetEmbedVisibility() {
    return StorageActions.actionOnGlobalItemsWithPrefix(StoragePrefixes.EMBED_VISIBLE, () => null);
}

export function toggleInlineImageVisibility(postId: string, imageKey: string): ThunkActionFunc<void, GlobalState> {
    return (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const visible = isInlineImageVisible(state, postId, imageKey);

        dispatch(StorageActions.setGlobalItem(StoragePrefixes.INLINE_IMAGE_VISIBLE + currentUserId + '_' + postId + '_' + imageKey, !visible));
    };
}

export function resetInlineImageVisibility() {
    return StorageActions.actionOnGlobalItemsWithPrefix(StoragePrefixes.INLINE_IMAGE_VISIBLE, () => null);
}

/*
 * It is called from either center or rhs text input when shortcut for react to last message is pressed
 *
 * @param {string} emittedFrom - It can be either "CENTER", "RHS_ROOT" or "NO_WHERE"
 */
export function emitShortcutReactToLastPostFrom(emittedFrom: keyof typeof Constants.Locations) {
    return {
        type: ActionTypes.EMITTED_SHORTCUT_REACT_TO_LAST_POST,
        payload: emittedFrom,
    };
}
