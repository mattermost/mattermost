// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Post} from '@mattermost/types/posts';
import {GroupChannel} from '@mattermost/types/groups';
import {FileInfo} from '@mattermost/types/files';

import {SearchTypes} from 'mattermost-redux/action_types';
import {getMyChannelMember} from 'mattermost-redux/actions/channels';
import {getChannel, getMyChannelMember as getMyChannelMemberSelector} from 'mattermost-redux/selectors/entities/channels';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import * as ThreadActions from 'mattermost-redux/actions/threads';
import * as PostActions from 'mattermost-redux/actions/posts';
import * as PostSelectors from 'mattermost-redux/selectors/entities/posts';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {canEditPost, comparePosts} from 'mattermost-redux/utils/post_utils';
import {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

import {addRecentEmoji} from 'actions/emoji_actions';
import * as StorageActions from 'actions/storage';
import {loadNewDMIfNeeded, loadNewGMIfNeeded} from 'actions/user_actions';
import * as RhsActions from 'actions/views/rhs';
import {manuallyMarkThreadAsUnread} from 'actions/views/threads';
import {removeDraft} from 'actions/views/drafts';
import {isEmbedVisible, isInlineImageVisible} from 'selectors/posts';
import {getSelectedPostId, getSelectedPostCardId, getRhsState} from 'selectors/rhs';
import {getGlobalItem} from 'selectors/storage';
import {GlobalState} from 'types/store';
import {
    ActionTypes,
    Constants,
    RHSStates,
    StoragePrefixes,
} from 'utils/constants';
import {matchEmoticons} from 'utils/emoticons';
import * as UserAgent from 'utils/user_agent';

import {completePostReceive, NewPostMessageProps} from './new_post';

export function handleNewPost(post: Post, msg?: {data?: NewPostMessageProps & GroupChannel}) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function flagPost(postId: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        await dispatch(PostActions.flagPost(postId));
        const state = getState() as GlobalState;
        const rhsState = getRhsState(state);

        if (rhsState === RHSStates.FLAG) {
            dispatch(addPostToSearchResults(postId));
        }

        return {data: true};
    };
}

export function unflagPost(postId: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        await dispatch(PostActions.unflagPost(postId));
        const state = getState() as GlobalState;
        const rhsState = getRhsState(state);

        if (rhsState === RHSStates.FLAG) {
            removePostFromSearchResults(postId, state, dispatch);
        }

        return {data: true};
    };
}

export function createPost(post: Post, files: FileInfo[]) {
    return async (dispatch: DispatchFunc) => {
        // parse message and emit emoji event
        const emojis = matchEmoticons(post.message);
        if (emojis) {
            for (const emoji of emojis) {
                const trimmed = emoji.substring(1, emoji.length - 1);
                dispatch(addRecentEmoji(trimmed));
            }
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

function storeDraft(channelId: string, draft: null) {
    return (dispatch: DispatchFunc) => {
        dispatch(StorageActions.setGlobalItem('draft_' + channelId, draft));
        return {data: true};
    };
}

function storeCommentDraft(rootPostId: string, draft: null) {
    return (dispatch: DispatchFunc) => {
        dispatch(StorageActions.setGlobalItem('comment_draft_' + rootPostId, draft));
        return {data: true};
    };
}

export function addReaction(postId: string, emojiName: string) {
    return (dispatch: DispatchFunc) => {
        dispatch(PostActions.addReaction(postId, emojiName));
        dispatch(addRecentEmoji(emojiName));
        return {data: true};
    };
}

export function searchForTerm(term: string) {
    return (dispatch: DispatchFunc) => {
        dispatch(RhsActions.updateSearchTerms(term));
        dispatch(RhsActions.showSearchResults());
        return {data: true};
    };
}

function addPostToSearchResults(postId: string) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function pinPost(postId: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        await dispatch(PostActions.pinPost(postId));
        const state = getState() as GlobalState;
        const rhsState = getRhsState(state);

        if (rhsState === RHSStates.PIN) {
            dispatch(addPostToSearchResults(postId));
        }
        return {data: true};
    };
}

export function unpinPost(postId: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        await dispatch(PostActions.unpinPost(postId));
        const state = getState() as GlobalState;
        const rhsState = getRhsState(state);

        if (rhsState === RHSStates.PIN) {
            removePostFromSearchResults(postId, state, dispatch);
        }
        return {data: true};
    };
}

export function setEditingPost(postId = '', refocusId = '', title = '', isRHS = false) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const post = PostSelectors.getPost(state, postId);

        if (!post || post.pending_post_id === postId) {
            return {data: false};
        }

        const config = state.entities.general.config;
        const license = state.entities.general.license;
        const userId = getCurrentUserId(state);
        const channel = getChannel(state, post.channel_id);
        const teamId = channel.team_id || '';

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

export function markPostAsUnread(post: Post, location: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function markMostRecentPostInChannelAsUnread(channelId: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function deleteAndRemovePost(post: Post) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const {error} = await dispatch(PostActions.deletePost(post));
        if (error) {
            return {error};
        }

        if (post.id === getSelectedPostId(getState() as GlobalState)) {
            dispatch({
                type: ActionTypes.SELECT_POST,
                postId: '',
                channelId: '',
                timestamp: 0,
            });
        }

        if (post.id === getSelectedPostCardId(getState() as GlobalState)) {
            dispatch({
                type: ActionTypes.SELECT_POST_CARD,
                postId: '',
                channelId: '',
            });
        }

        if (post.root_id === '') {
            const key = StoragePrefixes.COMMENT_DRAFT + post.id;
            if (getGlobalItem(getState() as GlobalState, key, null)) {
                dispatch(removeDraft(key, post.channel_id, post.id));
            }
        }

        dispatch(PostActions.removePost(post));

        return {data: true};
    };
}

export function toggleEmbedVisibility(postId: string) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const visible = isEmbedVisible(state as GlobalState, postId);

        dispatch(StorageActions.setGlobalItem(StoragePrefixes.EMBED_VISIBLE + currentUserId + '_' + postId, !visible));
    };
}

export function resetEmbedVisibility() {
    return StorageActions.actionOnGlobalItemsWithPrefix(StoragePrefixes.EMBED_VISIBLE, () => null);
}

export function toggleInlineImageVisibility(postId: string, imageKey: string) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const visible = isInlineImageVisible(state as GlobalState, postId, imageKey);

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
export function emitShortcutReactToLastPostFrom(emittedFrom: 'CENTER' | 'RHS_ROOT' | 'NO_WHERE') {
    return {
        type: ActionTypes.EMITTED_SHORTCUT_REACT_TO_LAST_POST,
        payload: emittedFrom,
    };
}
