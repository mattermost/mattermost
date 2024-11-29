// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';

import type {Channel, ChannelUnread} from '@mattermost/types/channels';
import type {FetchPaginatedThreadOptions} from '@mattermost/types/client4';
import type {Group} from '@mattermost/types/groups';
import {isMessageAttachmentArray} from '@mattermost/types/message_attachments';
import type {Post, PostList, PostAcknowledgement} from '@mattermost/types/posts';
import type {Reaction} from '@mattermost/types/reactions';
import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import {PostTypes, ChannelTypes, FileTypes, IntegrationTypes} from 'mattermost-redux/action_types';
import {selectChannel} from 'mattermost-redux/actions/channels';
import {systemEmojis, getCustomEmojiByName} from 'mattermost-redux/actions/emojis';
import {searchGroups} from 'mattermost-redux/actions/groups';
import {bindClientFunc, forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {
    deletePreferences,
    savePreferences,
} from 'mattermost-redux/actions/preferences';
import {batchFetchStatusesProfilesGroupsFromPosts} from 'mattermost-redux/actions/status_profile_polling';
import {decrementThreadCounts} from 'mattermost-redux/actions/threads';
import {getProfilesByIds, getProfilesByUsernames, getStatusesByIds} from 'mattermost-redux/actions/users';
import {Client4, DEFAULT_LIMIT_AFTER, DEFAULT_LIMIT_BEFORE} from 'mattermost-redux/client';
import {General, Preferences, Posts} from 'mattermost-redux/constants';
import {getCurrentChannelId, getMyChannelMember as getMyChannelMemberSelector} from 'mattermost-redux/selectors/entities/channels';
import {getIsUserStatusesConfigEnabled} from 'mattermost-redux/selectors/entities/common';
import {getCustomEmojisByName as selectCustomEmojisByName} from 'mattermost-redux/selectors/entities/emojis';
import {getAllGroupsByName} from 'mattermost-redux/selectors/entities/groups';
import * as PostSelectors from 'mattermost-redux/selectors/entities/posts';
import {getUnreadScrollPositionPreference, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId, getUsersByUsername} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult, DispatchFunc, GetStateFunc, ActionFunc, ActionFuncAsync, ThunkActionFunc} from 'mattermost-redux/types/actions';
import {isCombinedUserActivityPost} from 'mattermost-redux/utils/post_list';

import {logError} from './errors';

// receivedPost should be dispatched after a single post from the server. This typically happens when an existing post
// is updated.
export function receivedPost(post: Post, crtEnabled?: boolean) {
    return {
        type: PostTypes.RECEIVED_POST,
        data: post,
        features: {crtEnabled},
    };
}

// receivedNewPost should be dispatched when receiving a newly created post or when sending a request to the server
// to make a new post.
export function receivedNewPost(post: Post, crtEnabled: boolean) {
    return {
        type: PostTypes.RECEIVED_NEW_POST,
        data: post,
        features: {crtEnabled},
    };
}

// receivedPosts should be dispatched when receiving multiple posts from the server that may or may not be ordered.
// This will typically be used alongside other actions like receivedPostsAfter which require the posts to be ordered.
export function receivedPosts(posts: PostList) {
    return {
        type: PostTypes.RECEIVED_POSTS,
        data: posts,
    };
}

// receivedPostsAfter should be dispatched when receiving an ordered list of posts that come before a given post.
export function receivedPostsAfter(posts: PostList, channelId: string, afterPostId: string, recent = false) {
    return {
        type: PostTypes.RECEIVED_POSTS_AFTER,
        channelId,
        data: posts,
        afterPostId,
        recent,
    };
}

// receivedPostsBefore should be dispatched when receiving an ordered list of posts that come after a given post.
export function receivedPostsBefore(posts: PostList, channelId: string, beforePostId: string, oldest = false) {
    return {
        type: PostTypes.RECEIVED_POSTS_BEFORE,
        channelId,
        data: posts,
        beforePostId,
        oldest,
    };
}

// receivedPostsSince should be dispatched when receiving a list of posts that have been updated since a certain time.
// Due to how the API endpoint works, some of these posts will be ordered, but others will not, so this needs special
// handling from the reducers.
export function receivedPostsSince(posts: PostList, channelId: string) {
    return {
        type: PostTypes.RECEIVED_POSTS_SINCE,
        channelId,
        data: posts,
    };
}

// receivedPostsInChannel should be dispatched when receiving a list of ordered posts within a channel when the
// the adjacent posts are not known.
export function receivedPostsInChannel(posts: PostList, channelId: string, recent = false, oldest = false) {
    return {
        type: PostTypes.RECEIVED_POSTS_IN_CHANNEL,
        channelId,
        data: posts,
        recent,
        oldest,
    };
}

// receivedPostsInThread should be dispatched when receiving a list of unordered posts in a thread.
export function receivedPostsInThread(posts: PostList, rootId: string) {
    return {
        type: PostTypes.RECEIVED_POSTS_IN_THREAD,
        data: posts,
        rootId,
    };
}

// postDeleted should be dispatched when a post has been deleted and should be replaced with a "message deleted"
// placeholder. This typically happens when a post is deleted by another user.
export function postDeleted(post: Post) {
    return {
        type: PostTypes.POST_DELETED,
        data: post,
    };
}

// postRemoved should be dispatched when a post should be immediately removed. This typically happens when a post is
// deleted by the current user.
export function postRemoved(post: Post) {
    return {
        type: PostTypes.POST_REMOVED,
        data: post,
    };
}

export function postPinnedChanged(postId: string, isPinned: boolean, updateAt = Date.now()) {
    return {
        type: PostTypes.POST_PINNED_CHANGED,
        postId,
        isPinned,
        updateAt,
    };
}

export function getPost(postId: string): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        let post;
        const crtEnabled = isCollapsedThreadsEnabled(getState());

        try {
            post = await Client4.getPost(postId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: PostTypes.GET_POSTS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(receivedPost(post, crtEnabled));
        dispatch(batchFetchStatusesProfilesGroupsFromPosts([post]));

        return {data: post};
    };
}

export type CreatePostReturnType = {
    created?: boolean;
    pending?: string;
    error?: string;
}

export function createPost(
    post: Post,
    files: any[] = [],
    afterSubmit?: (response: any) => void,
): ActionFuncAsync<CreatePostReturnType, GlobalState> {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = state.entities.users.currentUserId;

        const timestamp = Date.now();
        const pendingPostId = post.pending_post_id || `${currentUserId}:${timestamp}`;
        let actions: AnyAction[] = [];

        if (PostSelectors.isPostIdSending(state, pendingPostId)) {
            return {data: {pending: pendingPostId}};
        }

        let newPost = {
            ...post,
            pending_post_id: pendingPostId,
            create_at: timestamp,
            update_at: timestamp,
            reply_count: 0,
        };

        if (post.root_id) {
            newPost.reply_count = PostSelectors.getPostRepliesCount(state, post.root_id) + 1;
        }

        // We are retrying a pending post that had files
        if (newPost.file_ids && !files.length) {
            // eslint-disable-next-line no-param-reassign
            files = newPost.file_ids.map((id) => state.entities.files.files[id]);
        }

        if (files.length) {
            const fileIds = files.map((file) => file.id);

            newPost = {
                ...newPost,
                file_ids: fileIds,
            };

            actions.push({
                type: FileTypes.RECEIVED_FILES_FOR_POST,
                postId: pendingPostId,
                data: files,
            }, {
                type: ChannelTypes.INCREMENT_FILE_COUNT,
                amount: files.length,
                id: newPost.channel_id,
            });
        }

        const crtEnabled = isCollapsedThreadsEnabled(getState());
        actions.push({
            type: PostTypes.RECEIVED_NEW_POST,
            data: {
                ...newPost,
                id: pendingPostId,
            },
            features: {crtEnabled},
        });

        dispatch(batchActions(actions, 'BATCH_CREATE_POST_INIT'));

        (async function createPostWrapper() {
            try {
                const created = await Client4.createPost({...newPost, create_at: 0});

                actions = [
                    receivedPost(created, crtEnabled),
                    {
                        type: PostTypes.CREATE_POST_SUCCESS,
                    },
                    {
                        type: ChannelTypes.INCREMENT_TOTAL_MSG_COUNT,
                        data: {
                            channelId: newPost.channel_id,
                            amount: 1,
                            amountRoot: created.root_id === '' ? 1 : 0,
                        },
                    },
                    {
                        type: ChannelTypes.DECREMENT_UNREAD_MSG_COUNT,
                        data: {
                            channelId: newPost.channel_id,
                            amount: 1,
                            amountRoot: created.root_id === '' ? 1 : 0,
                        },
                    },
                ];

                if (files) {
                    actions.push({
                        type: FileTypes.RECEIVED_FILES_FOR_POST,
                        postId: created.id,
                        data: files,
                    });
                }

                dispatch(batchActions(actions, 'BATCH_CREATE_POST'));
                afterSubmit?.({created});
                return {data: {created}};
            } catch (error) {
                const data = {
                    ...newPost,
                    id: pendingPostId,
                    failed: true,
                    update_at: Date.now(),
                };
                actions = [{type: PostTypes.CREATE_POST_FAILURE, error}];

                // If the failure was because: the root post was deleted or
                // TownSquareIsReadOnly=true then remove the post
                if (error.server_error_id === 'api.post.create_post.root_id.app_error' ||
                    error.server_error_id === 'api.post.create_post.town_square_read_only' ||
                    error.server_error_id === 'plugin.message_will_be_posted.dismiss_post'
                ) {
                    // RemovePost is a Thunk, and not handled by batchActions
                    dispatch(removePost(data));
                } else {
                    actions.push(receivedPost(data, crtEnabled));
                }

                dispatch(batchActions(actions, 'BATCH_CREATE_POST_FAILED'));
                return {error};
            }
        }());

        return {data: {created: true}};
    };
}

export function resetCreatePostRequest() {
    return {type: PostTypes.CREATE_POST_RESET_REQUEST};
}

export function deletePost(post: ExtendedPost): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const delPost = {...post};
        if (!post.root_id && isCollapsedThreadsEnabled(state)) {
            dispatch(decrementThreadCounts(post));
        }
        if (delPost.type === Posts.POST_TYPES.COMBINED_USER_ACTIVITY && delPost.system_post_ids) {
            delPost.system_post_ids.forEach((systemPostId) => {
                const systemPost = PostSelectors.getPost(state, systemPostId);
                if (systemPost) {
                    dispatch(deletePost(systemPost));
                }
            });
        } else {
            (async function deletePostWrapper() {
                try {
                    dispatch({
                        type: PostTypes.POST_DELETED,
                        data: delPost,
                    });

                    await Client4.deletePost(post.id);
                } catch (e) {
                    // Recovering from this state doesn't actually work. The deleteAndRemovePost action
                    // in the webapp needs to get an error in order to not call removePost, but then
                    // the delete modal needs to handle this to show something to the user. Since none
                    // of that ever worked (even with redux-offline in play), leave the behaviour here
                    // unresolved.
                    console.error('failed to delete post', e); // eslint-disable-line no-console
                }
            }());
        }

        return {data: true};
    };
}

export function editPost(post: Post) {
    return bindClientFunc({
        clientFunc: Client4.patchPost,
        onRequest: PostTypes.EDIT_POST_REQUEST,
        onSuccess: [PostTypes.RECEIVED_POST, PostTypes.EDIT_POST_SUCCESS],
        onFailure: PostTypes.EDIT_POST_FAILURE,
        params: [
            post,
        ],
    });
}

function getUnreadPostData(unreadChan: ChannelUnread, state: GlobalState) {
    const member = getMyChannelMemberSelector(state, unreadChan.channel_id);
    const delta = member ? member.msg_count - unreadChan.msg_count : unreadChan.msg_count;
    const deltaRoot = member ? member.msg_count_root - unreadChan.msg_count_root : unreadChan.msg_count_root;

    const data = {
        teamId: unreadChan.team_id,
        channelId: unreadChan.channel_id,
        msgCount: unreadChan.msg_count,
        mentionCount: unreadChan.mention_count,
        msgCountRoot: unreadChan.msg_count_root,
        mentionCountRoot: unreadChan.mention_count_root,
        urgentMentionCount: unreadChan.urgent_mention_count,
        lastViewedAt: unreadChan.last_viewed_at,
        deltaMsgs: delta,
        deltaMsgsRoot: deltaRoot,
    };

    return data;
}

export function setUnreadPost(userId: string, postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        let state = getState();
        const post = PostSelectors.getPost(state, postId);
        let unreadChan;

        try {
            if (isCombinedUserActivityPost(postId)) {
                return {};
            }
            dispatch({
                type: ChannelTypes.ADD_MANUALLY_UNREAD,
                data: {
                    channelId: post.channel_id,
                },
            });
            unreadChan = await Client4.markPostAsUnread(userId, postId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            dispatch({
                type: ChannelTypes.REMOVE_MANUALLY_UNREAD,
                data: {
                    channelId: post.channel_id,
                },
            });
            return {error};
        }

        state = getState();
        const data = getUnreadPostData(unreadChan, state);
        dispatch({
            type: ChannelTypes.POST_UNREAD_SUCCESS,
            data,
        });
        return {data};
    };
}

export function pinPost(postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        dispatch({type: PostTypes.EDIT_POST_REQUEST});
        let posts;

        try {
            posts = await Client4.pinPost(postId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: PostTypes.EDIT_POST_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        const actions: AnyAction[] = [
            {
                type: PostTypes.EDIT_POST_SUCCESS,
            },
        ];

        const state = getState();
        const post = PostSelectors.getPost(state, postId);
        if (post) {
            actions.push(
                postPinnedChanged(postId, true, Date.now()),
                {
                    type: ChannelTypes.INCREMENT_PINNED_POST_COUNT,
                    id: post.channel_id,
                },
            );
        }

        dispatch(batchActions(actions));

        return {data: posts};
    };
}

/**
 * Decrements the pinned post count for a channel by 1
 */
export function decrementPinnedPostCount(channelId: Channel['id']) {
    return {
        type: ChannelTypes.DECREMENT_PINNED_POST_COUNT,
        id: channelId,
    };
}

export function unpinPost(postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        dispatch({type: PostTypes.EDIT_POST_REQUEST});
        let posts;

        try {
            posts = await Client4.unpinPost(postId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: PostTypes.EDIT_POST_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        const actions: AnyAction[] = [
            {
                type: PostTypes.EDIT_POST_SUCCESS,
            },
        ];

        const state = getState();
        const post = PostSelectors.getPost(state, postId);
        if (post) {
            actions.push(
                postPinnedChanged(postId, false, Date.now()),
                decrementPinnedPostCount(post.channel_id),
            );
        }

        dispatch(batchActions(actions));

        return {data: posts};
    };
}

export type SubmitReactionReturnType = {
    reaction?: Reaction;
    removedReaction?: boolean;
}

export function addReaction(postId: string, emojiName: string): ActionFuncAsync<SubmitReactionReturnType, GlobalState> {
    return async (dispatch, getState) => {
        const currentUserId = getState().entities.users.currentUserId;

        let reaction;
        try {
            reaction = await Client4.addReaction(currentUserId, postId, emojiName);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: PostTypes.RECEIVED_REACTION,
            data: reaction,
        });

        return {data: {reaction}};
    };
}

export function removeReaction(postId: string, emojiName: string): ActionFuncAsync<SubmitReactionReturnType, GlobalState> {
    return async (dispatch, getState) => {
        const currentUserId = getState().entities.users.currentUserId;

        try {
            await Client4.removeReaction(currentUserId, postId, emojiName);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: PostTypes.REACTION_DELETED,
            data: {user_id: currentUserId, post_id: postId, emoji_name: emojiName},
        });

        return {data: {removedReaction: true}};
    };
}

export function getCustomEmojiForReaction(name: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const nonExistentEmoji = getState().entities.emojis.nonExistentEmoji;
        const customEmojisByName = selectCustomEmojisByName(getState());

        if (systemEmojis.has(name)) {
            return {data: true};
        }

        if (nonExistentEmoji.has(name)) {
            return {data: true};
        }

        if (customEmojisByName.has(name)) {
            return {data: true};
        }

        return dispatch(getCustomEmojiByName(name));
    };
}

export function flagPost(postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const {currentUserId} = getState().entities.users;
        const preference = {
            user_id: currentUserId,
            category: Preferences.CATEGORY_FLAGGED_POST,
            name: postId,
            value: 'true',
        };

        Client4.trackEvent('action', 'action_posts_flag');

        return dispatch(savePreferences(currentUserId, [preference]));
    };
}

async function getPaginatedPostThread(rootId: string, options: FetchPaginatedThreadOptions, prevList?: PostList): Promise<PostList> {
    // since there are no complicated things inside (functions, Maps, Sets, etc.) we
    // can use the JSON approach to deep-copy the object
    const list: PostList = prevList ? JSON.parse(JSON.stringify(prevList)) : {
        order: [rootId],
        posts: {},
        prev_post_id: '',
        next_post_id: '',
        first_inaccessible_post_time: 0,
    };

    const result = await Client4.getPaginatedPostThread(rootId, options);

    if (result.first_inaccessible_post_time) {
        list.first_inaccessible_post_time = list.first_inaccessible_post_time ? Math.min(result.first_inaccessible_post_time, list.first_inaccessible_post_time) : result.first_inaccessible_post_time;
    }
    list.order.push(...result.order.slice(1));
    list.posts = Object.assign(list.posts, result.posts);

    if (result.has_next) {
        const [nextPostId] = list.order!.slice(-1);
        const nextPostPointer = list.posts[nextPostId];
        const newOptions = {
            ...options,
            fromCreateAt: nextPostPointer.create_at,
            fromPost: nextPostId,
        };

        return getPaginatedPostThread(rootId, newOptions, list);
    }

    return list;
}

export function getPostThread(rootId: string, fetchThreads = true): ActionFuncAsync<PostList> {
    return async (dispatch, getState) => {
        const state = getState();
        const collapsedThreadsEnabled = isCollapsedThreadsEnabled(state);
        const enabledUserStatuses = getIsUserStatusesConfigEnabled(state);

        let posts;
        try {
            posts = await getPaginatedPostThread(rootId, {fetchThreads, collapsedThreads: collapsedThreadsEnabled});
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            receivedPosts(posts),
            receivedPostsInThread(posts, rootId),
        ]));

        if (enabledUserStatuses) {
            dispatch(batchFetchStatusesProfilesGroupsFromPosts(posts.posts));
        }

        return {data: posts};
    };
}

export function getNewestPostThread(rootId: string): ActionFuncAsync {
    const getPostsForThread = PostSelectors.makeGetPostsForThread();

    return async (dispatch, getState) => {
        dispatch({type: PostTypes.GET_POST_THREAD_REQUEST});
        const collapsedThreadsEnabled = isCollapsedThreadsEnabled(getState());
        const savedPosts = getPostsForThread(getState(), rootId);

        const latestReply = savedPosts?.[0];

        const options: FetchPaginatedThreadOptions = {
            fetchThreads: true,
            collapsedThreads: collapsedThreadsEnabled,
            direction: 'down',
            fromCreateAt: latestReply?.create_at,
            fromPost: latestReply?.id,
        };

        let posts;
        try {
            posts = await getPaginatedPostThread(rootId, options);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: PostTypes.GET_POST_THREAD_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            receivedPosts(posts),
            receivedPostsInThread(posts, rootId),
        ]));
        dispatch(batchFetchStatusesProfilesGroupsFromPosts(posts.posts));

        return {data: posts};
    };
}

export function getPosts(channelId: string, page = 0, perPage = Posts.POST_CHUNK_SIZE, fetchThreads = true, collapsedThreadsExtended = false): ActionFuncAsync<PostList> {
    return async (dispatch, getState) => {
        let posts;
        const collapsedThreadsEnabled = isCollapsedThreadsEnabled(getState());
        try {
            posts = await Client4.getPosts(channelId, page, perPage, fetchThreads, collapsedThreadsEnabled, collapsedThreadsExtended);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            receivedPosts(posts),
            receivedPostsInChannel(posts, channelId, page === 0, posts.prev_post_id === ''),
        ]));
        dispatch(batchFetchStatusesProfilesGroupsFromPosts(posts.posts));

        return {data: posts};
    };
}

export function getPostsUnread(channelId: string, fetchThreads = true, collapsedThreadsExtended = false): ActionFuncAsync<PostList> {
    return async (dispatch, getState) => {
        const state = getState();
        const shouldLoadRecent = getUnreadScrollPositionPreference(state) === Preferences.UNREAD_SCROLL_POSITION_START_FROM_NEWEST;
        const collapsedThreadsEnabled = isCollapsedThreadsEnabled(state);
        const userId = getCurrentUserId(state);

        let posts;
        let recentPosts;
        try {
            posts = await Client4.getPostsUnread(channelId, userId, DEFAULT_LIMIT_BEFORE, DEFAULT_LIMIT_AFTER, fetchThreads, collapsedThreadsEnabled, collapsedThreadsExtended);

            if (posts.next_post_id && shouldLoadRecent) {
                recentPosts = await Client4.getPosts(channelId, 0, Posts.POST_CHUNK_SIZE / 2, fetchThreads, collapsedThreadsEnabled, collapsedThreadsExtended);
            }
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const actions: AnyAction[] = [
            {
                type: PostTypes.RECEIVED_POSTS,
                data: posts,
                channelId,
            },
            receivedPostsInChannel(posts, channelId, posts.next_post_id === '', posts.prev_post_id === ''),
        ];
        if (recentPosts) {
            actions.push(
                receivedPosts(recentPosts),
                receivedPostsInChannel(recentPosts, channelId, recentPosts.next_post_id === '', recentPosts.prev_post_id === ''),
            );
        }

        dispatch(batchActions(actions));
        dispatch(batchFetchStatusesProfilesGroupsFromPosts(posts.posts));

        return {data: posts};
    };
}

export function getPostsSince(channelId: string, since: number, fetchThreads = true, collapsedThreadsExtended = false): ActionFuncAsync<PostList> {
    return async (dispatch, getState) => {
        let posts;
        try {
            const collapsedThreadsEnabled = isCollapsedThreadsEnabled(getState());
            posts = await Client4.getPostsSince(channelId, since, fetchThreads, collapsedThreadsEnabled, collapsedThreadsExtended);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            receivedPosts(posts),
            receivedPostsSince(posts, channelId),
        ]));
        dispatch(batchFetchStatusesProfilesGroupsFromPosts(posts.posts));

        return {data: posts};
    };
}

export function getPostsBefore(channelId: string, postId: string, page = 0, perPage = Posts.POST_CHUNK_SIZE, fetchThreads = true, collapsedThreadsExtended = false): ActionFuncAsync<PostList> {
    return async (dispatch, getState) => {
        let posts;
        try {
            const collapsedThreadsEnabled = isCollapsedThreadsEnabled(getState());
            posts = await Client4.getPostsBefore(channelId, postId, page, perPage, fetchThreads, collapsedThreadsEnabled, collapsedThreadsExtended);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            receivedPosts(posts),
            receivedPostsBefore(posts, channelId, postId, posts.prev_post_id === ''),
        ]));
        dispatch(batchFetchStatusesProfilesGroupsFromPosts(posts.posts));

        return {data: posts};
    };
}

export function getPostsAfter(channelId: string, postId: string, page = 0, perPage = Posts.POST_CHUNK_SIZE, fetchThreads = true, collapsedThreadsExtended = false): ActionFuncAsync<PostList> {
    return async (dispatch, getState) => {
        let posts;
        try {
            const collapsedThreadsEnabled = isCollapsedThreadsEnabled(getState());
            posts = await Client4.getPostsAfter(channelId, postId, page, perPage, fetchThreads, collapsedThreadsEnabled, collapsedThreadsExtended);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            receivedPosts(posts),
            receivedPostsAfter(posts, channelId, postId, posts.next_post_id === ''),
        ]));
        dispatch(batchFetchStatusesProfilesGroupsFromPosts(posts.posts));

        return {data: posts};
    };
}

export function getPostsAround(channelId: string, postId: string, perPage = Posts.POST_CHUNK_SIZE / 2, fetchThreads = true, collapsedThreadsExtended = false): ActionFuncAsync<PostList> {
    return async (dispatch, getState) => {
        let after;
        let thread;
        let before;

        try {
            const collapsedThreadsEnabled = isCollapsedThreadsEnabled(getState());
            [after, thread, before] = await Promise.all([
                Client4.getPostsAfter(channelId, postId, 0, perPage, fetchThreads, collapsedThreadsEnabled, collapsedThreadsExtended),
                Client4.getPostThread(postId, fetchThreads, collapsedThreadsEnabled, collapsedThreadsExtended),
                Client4.getPostsBefore(channelId, postId, 0, perPage, fetchThreads, collapsedThreadsEnabled, collapsedThreadsExtended),
            ]);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        // Dispatch a combined post list so that the order is correct for postsInChannel
        const posts: PostList = {
            posts: {
                ...after.posts,
                ...thread.posts,
                ...before.posts,
            },
            order: [ // Remember that the order is newest posts first
                ...after.order,
                postId,
                ...before.order,
            ],
            next_post_id: after.next_post_id,
            prev_post_id: before.prev_post_id,
            first_inaccessible_post_time: Math.max(before.first_inaccessible_post_time, after.first_inaccessible_post_time, thread.first_inaccessible_post_time) || 0,
        };

        dispatch(batchActions([
            receivedPosts(posts),
            receivedPostsInChannel(posts, channelId, after.next_post_id === '', before.prev_post_id === ''),
        ]));
        dispatch(batchFetchStatusesProfilesGroupsFromPosts(posts.posts));

        return {data: posts};
    };
}

/**
 * getPostThreads is intended for an array of posts that have been batched
 * (see the actions/websocket_actions/handleNewPostEvents function in the webapp)
* */
export function getPostThreads(posts: Post[], fetchThreads = true): ThunkActionFunc<unknown> {
    return (dispatch, getState) => {
        if (!Array.isArray(posts) || !posts.length) {
            return {data: true};
        }

        const state = getState();
        const currentChannelId = getCurrentChannelId(state);

        const getPostThreadPromises: Array<Promise<ActionResult<PostList>>> = [];

        const rootPostIds = new Set<string>();

        for (const post of posts) {
            if (!post.root_id) {
                continue;
            }

            const rootPost = PostSelectors.getPost(state, post.root_id);
            if (rootPost) {
                continue;
            }

            if (rootPostIds.has(post.root_id)) {
                continue;
            }

            // At this point, we know that this post is a thread/reply and its root post is not in the store
            rootPostIds.add(post.root_id);

            if (post.channel_id === currentChannelId) {
                getPostThreadPromises.push(dispatch(getPostThread(post.root_id, fetchThreads)));
            }
        }

        return Promise.all(getPostThreadPromises);
    };
}

// Note that getMentionsAndStatusesForPosts can take either an array of posts or a map of ids to posts
export async function getMentionsAndStatusesForPosts(postsArrayOrMap: Post[]|PostList['posts'], dispatch: DispatchFunc, getState: GetStateFunc) {
    if (!postsArrayOrMap) {
        // Some API methods return {error} for no results
        return Promise.resolve();
    }

    const postsArray: Post[] = Array.isArray(postsArrayOrMap) ? postsArrayOrMap : Object.values(postsArrayOrMap);

    if (postsArray.length === 0) {
        return Promise.resolve();
    }

    const postsDictionary: Record<string, Post> = {};
    for (let i = 0; i < postsArray.length; i++) {
        postsDictionary[postsArray[i].id] = postsArray[i];
    }

    const state = getState();
    const {currentUserId, profiles, statuses} = state.entities.users;
    const enabledUserStatuses = getIsUserStatusesConfigEnabled(state);

    // Statuses and profiles of the users who made the posts
    const userIdsToLoad = new Set<string>();
    const statusesToLoad = new Set<string>();

    postsArray.forEach((post) => {
        const userId = post.user_id;

        if (post.metadata) {
            if (post.metadata.embeds) {
                post.metadata.embeds.forEach((embed: any) => {
                    if (embed.type === 'permalink' && embed.data) {
                        if (embed.data.post?.user_id && !profiles[embed.data.post.user_id] && embed.data.post.user_id !== currentUserId) {
                            userIdsToLoad.add(embed.data.post.user_id);
                        }
                        if (embed.data.post?.user_id && !statuses[embed.data.post.user_id]) {
                            statusesToLoad.add(embed.data.post.user_id);
                        }
                    }
                });
            }

            if (post.metadata.acknowledgements) {
                post.metadata.acknowledgements.forEach((ack: any) => {
                    if (ack.acknowledged_at > 0) {
                        userIdsToLoad.add(ack.user_id);
                    }
                });
            }
        }

        if (!statuses[userId]) {
            statusesToLoad.add(userId);
        }

        if (userId === currentUserId) {
            return;
        }

        if (!profiles[userId]) {
            userIdsToLoad.add(userId);
        }
    });

    const promises: any[] = [];
    if (userIdsToLoad.size > 0) {
        promises.push(dispatch(getProfilesByIds(Array.from(userIdsToLoad))));
    }

    if (statusesToLoad.size > 0 && enabledUserStatuses) {
        promises.push(dispatch(getStatusesByIds(Array.from(statusesToLoad))));
    }

    // Profiles of users mentioned in the posts
    const usernamesAndGroupsToLoad = getNeededAtMentionedUsernamesAndGroups(state, postsArray);

    if (usernamesAndGroupsToLoad.size > 0) {
        // We need to load the profiles synchronously to filter them
        // out of the groups to check
        const getProfilesPromise = dispatch(getProfilesByUsernames(Array.from(usernamesAndGroupsToLoad)));
        promises.push(getProfilesPromise);

        const {data} = await getProfilesPromise as ActionResult<UserProfile[]>;
        const loadedProfiles = new Set<string>((data || []).map((p) => p.username));
        const groupsToCheck = Array.from(usernamesAndGroupsToLoad).filter((name) => !loadedProfiles.has(name));

        groupsToCheck.forEach((name) => {
            const groupParams = {
                q: name,
                filter_allow_reference: true,
                page: 0,
                per_page: 60,
                include_member_count: true,
            };
            promises.push(dispatch(searchGroups(groupParams)));
        });
    }

    return Promise.all(promises);
}

export function getPostsByIds(ids: string[]): ActionFuncAsync {
    return async (dispatch, getState) => {
        let posts;

        try {
            posts = await Client4.getPostsByIds(ids);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: PostTypes.RECEIVED_POSTS,
            data: {posts},
        });

        return {data: {posts}};
    };
}

export function getPostEditHistory(postId: string) {
    return bindClientFunc({
        clientFunc: Client4.getPostEditHistory,
        onSuccess: PostTypes.RECEIVED_POST_HISTORY,
        params: [postId],
    });
}

export function getNeededAtMentionedUsernamesAndGroups(state: GlobalState, posts: Post[]): Set<string> {
    let usersByUsername: Record<string, UserProfile>; // Populate this lazily since it's relatively expensive
    let groupsByName: Record<string, Group>;

    const usernamesAndGroupsToLoad = new Set<string>();

    function findNeededUsernamesAndGroups(text?: string) {
        if (!text || !text.includes('@')) {
            return;
        }

        if (!usersByUsername) {
            usersByUsername = getUsersByUsername(state);
        }

        if (!groupsByName) {
            groupsByName = getAllGroupsByName(state);
        }

        const pattern = /\B@(([a-z0-9_.-]*[a-z0-9_])[.-]*)/gi;

        let match;
        while ((match = pattern.exec(text)) !== null) {
            // match[1] is the matched mention including trailing punctuation
            // match[2] is the matched mention without trailing punctuation
            if (General.SPECIAL_MENTIONS.indexOf(match[2]) !== -1) {
                continue;
            }

            if (usersByUsername[match[1]] || usersByUsername[match[2]]) {
                // We have the user, go to the next match
                continue;
            }

            if (groupsByName[match[1]] || groupsByName[match[2]]) {
                // We have the group, go to the next match
                continue;
            }

            // If there's no trailing punctuation, this will only add 1 item to the set
            usernamesAndGroupsToLoad.add(match[1]);
            usernamesAndGroupsToLoad.add(match[2]);
        }
    }

    for (const post of posts) {
        // These correspond to the fields searched by getMentionsEnabledFields on the server
        findNeededUsernamesAndGroups(post.message);

        if (isMessageAttachmentArray(post.props?.attachments)) {
            for (const attachment of post.props.attachments) {
                findNeededUsernamesAndGroups(attachment.pretext);
                findNeededUsernamesAndGroups(attachment.text);

                if (attachment.fields) {
                    for (const field of attachment.fields) {
                        if (typeof field.value === 'string') {
                            findNeededUsernamesAndGroups(field.value);
                        }
                    }
                }
            }
        }
    }

    return usernamesAndGroupsToLoad;
}

export type ExtendedPost = Post & { system_post_ids?: string[] };

export function removePost(post: ExtendedPost): ActionFunc<boolean> {
    return (dispatch, getState) => {
        if (post.type === Posts.POST_TYPES.COMBINED_USER_ACTIVITY && post.system_post_ids) {
            const state = getState();
            for (const systemPostId of post.system_post_ids) {
                const systemPost = PostSelectors.getPost(state, systemPostId);

                if (systemPost) {
                    dispatch(removePost(systemPost));
                }
            }
        } else {
            dispatch(postRemoved(post));
            if (post.is_pinned) {
                dispatch(decrementPinnedPostCount(post.channel_id));
            }
        }
        return {data: true};
    };
}

export function moveThread(postId: string, channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.moveThread(postId, channelId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: PostTypes.MOVE_POST_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch({type: PostTypes.MOVE_POST_SUCCESS});

        return {data: true};
    };
}

export function selectFocusedPostId(postId: string) {
    return {
        type: PostTypes.RECEIVED_FOCUSED_POST,
        data: postId,
    };
}

export function unflagPost(postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const {currentUserId} = getState().entities.users;
        const preference = {
            user_id: currentUserId,
            category: Preferences.CATEGORY_FLAGGED_POST,
            name: postId,
            value: 'true',
        };

        Client4.trackEvent('action', 'action_posts_unflag');

        return dispatch(deletePreferences(currentUserId, [preference]));
    };
}

export function addPostReminder(userId: string, postId: string, timestamp: number): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.addPostReminder(userId, postId, timestamp);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
        return {data: true};
    };
}

export function doPostAction(postId: string, actionId: string, selectedOption = '') {
    return doPostActionWithCookie(postId, actionId, '', selectedOption);
}

export function doPostActionWithCookie(postId: string, actionId: string, actionCookie: string, selectedOption = ''): ActionFuncAsync {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.doPostActionWithCookie(postId, actionId, actionCookie, selectedOption);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        if (data && data.trigger_id) {
            dispatch({
                type: IntegrationTypes.RECEIVED_DIALOG_TRIGGER_ID,
                data: data.trigger_id,
            });
        }

        return {data};
    };
}

export function addMessageIntoHistory(message: string) {
    return {
        type: PostTypes.ADD_MESSAGE_INTO_HISTORY,
        data: message,
    };
}

export function resetHistoryIndex(index: string) {
    return {
        type: PostTypes.RESET_HISTORY_INDEX,
        data: index,
    };
}

export function moveHistoryIndexBack(index: string): ActionFuncAsync {
    return async (dispatch) => {
        dispatch({
            type: PostTypes.MOVE_HISTORY_INDEX_BACK,
            data: index,
        });

        return {data: true};
    };
}

export function moveHistoryIndexForward(index: string): ActionFuncAsync {
    return async (dispatch) => {
        dispatch({
            type: PostTypes.MOVE_HISTORY_INDEX_FORWARD,
            data: index,
        });

        return {data: true};
    };
}

/**
 * Ensures thread-replies in channels correctly follow CRT:ON/OFF
 */
export function resetReloadPostsInChannel(): ActionFuncAsync {
    return async (dispatch, getState) => {
        dispatch({
            type: PostTypes.RESET_POSTS_IN_CHANNEL,
        });

        const currentChannelId = getCurrentChannelId(getState());
        if (currentChannelId) {
            // wait for channel to be fully deselected; prevent stuck loading screen
            // full state-change/reconciliation will cause prefetchChannelPosts to reload posts
            await dispatch(selectChannel('')); // do not remove await
            dispatch(selectChannel(currentChannelId));
        }
        return {data: true};
    };
}

export function acknowledgePost(postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const userId = getCurrentUserId(getState());

        let data;
        try {
            data = await Client4.acknowledgePost(postId, userId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: PostTypes.CREATE_ACK_POST_SUCCESS,
            data,
        });

        return {data};
    };
}

export function unacknowledgePost(postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const userId = getCurrentUserId(getState());

        try {
            await Client4.unacknowledgePost(postId, userId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const data = {
            post_id: postId,
            user_id: userId,
            acknowledged_at: 0,
        } as PostAcknowledgement;

        dispatch({
            type: PostTypes.DELETE_ACK_POST_SUCCESS,
            data,
        });

        return {data};
    };
}
