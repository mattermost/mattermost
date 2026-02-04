// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {BreadcrumbPath, Wiki} from '@mattermost/types/wikis';

import {PostTypes as PostActionTypes, WikiTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError, LogErrorBarMode} from './errors';
import {forceLogoutIfNecessary} from './helpers';

// Local type definition (matches types/store/pages.ts)
// Cannot import from webapp due to mattermost-redux import restrictions
type InlineAnchor = {
    anchor_id: string;
    text: string;
};

// Wiki CRUD Operations

export function getWiki(wikiId: string): ActionFuncAsync<Wiki> {
    return async (dispatch, getState) => {
        try {
            const wiki = await Client4.getWiki(wikiId);

            dispatch({
                type: WikiTypes.RECEIVED_WIKI,
                data: wiki,
            });

            return {data: wiki};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function getChannelWikis(channelId: string): ActionFuncAsync<Wiki[]> {
    return async (dispatch, getState) => {
        try {
            const wikis = await Client4.getChannelWikis(channelId);

            if (wikis && wikis.length > 0) {
                dispatch({
                    type: WikiTypes.RECEIVED_WIKIS,
                    data: wikis,
                });
            }

            return {data: wikis};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function createWiki(channelId: string, title: string): ActionFuncAsync<Wiki> {
    return async (dispatch, getState) => {
        try {
            const wiki = await Client4.createWiki({
                channel_id: channelId,
                title,
            });

            dispatch({
                type: WikiTypes.RECEIVED_WIKI,
                data: wiki,
            });

            return {data: wiki};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function updateWiki(wiki: Wiki): ActionFuncAsync<Wiki> {
    return async (dispatch, getState) => {
        try {
            const updatedWiki = await Client4.updateWiki(wiki);

            dispatch({
                type: WikiTypes.RECEIVED_WIKI,
                data: updatedWiki,
            });

            return {data: updatedWiki};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function deleteWiki(wikiId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            // Get the channel ID before deletion so the reducer can clean up byChannel
            const state = getState();
            const wiki = state.entities.wikis.byId[wikiId];
            const channelId = wiki?.channel_id;

            await Client4.deleteWiki(wikiId);

            dispatch({
                type: WikiTypes.DELETED_WIKI,
                data: {wikiId, channelId},
            });

            return {data: true};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error, {errorBarMode: LogErrorBarMode.Always}));
            return {error};
        }
    };
}

export function moveWikiToChannel(wikiId: string, targetChannelId: string): ActionFuncAsync<Wiki> {
    return async (dispatch, getState) => {
        try {
            // Get the old channel ID before the move so the reducer can clean up
            const state = getState();
            const existingWiki = state.entities.wikis.byId[wikiId];
            const oldChannelId = existingWiki?.channel_id;

            const wiki = await Client4.moveWikiToChannel(wikiId, targetChannelId);

            dispatch({
                type: WikiTypes.RECEIVED_WIKI,
                data: wiki,
                oldChannelId,
            });

            return {data: wiki};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error, {errorBarMode: LogErrorBarMode.Always}));
            return {error};
        }
    };
}

// Page Operations

export function getPages(wikiId: string, page: number, perPage: number): ActionFuncAsync<Post[]> {
    return async (dispatch, getState) => {
        dispatch({type: WikiTypes.GET_PAGES_REQUEST, data: {wikiId}});

        try {
            const pages = await Client4.getPages(wikiId, page, perPage);

            dispatch({
                type: WikiTypes.GET_PAGES_SUCCESS,
                data: {wikiId, pages},
            });

            if (pages && pages.length > 0) {
                const state = getState();
                const existingPosts = state.entities.posts.posts;

                const postsToDispatch = pages.reduce((acc: Record<string, Post>, pagePost: Post) => {
                    const existingPost = existingPosts[pagePost.id];

                    // Preserve existing content if present (GetWikiPages returns pages without content)
                    if (existingPost && existingPost.message && existingPost.message.trim() !== '') {
                        acc[pagePost.id] = {
                            ...pagePost,
                            message: existingPost.message,
                        };
                    } else {
                        acc[pagePost.id] = pagePost;
                    }
                    return acc;
                }, {});

                dispatch({
                    type: PostActionTypes.RECEIVED_POSTS,
                    data: {
                        posts: postsToDispatch,
                    },
                });
            }

            return {data: pages};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: WikiTypes.GET_PAGES_FAILURE, data: {wikiId, error}});
            dispatch(logError(error));
            return {error};
        }
    };
}

export function getChannelPages(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            const data = await Client4.getChannelPages(channelId);

            dispatch({
                type: PostActionTypes.RECEIVED_POSTS,
                data,
                channelId,
            });

            return {data};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function getPage(wikiId: string, pageId: string): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        try {
            const data = await Client4.getPage(wikiId, pageId) as Post;

            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data,
            });

            // Extract and store page status in Redux
            const pageStatus = data.props?.page_status as string | undefined;
            if (pageStatus) {
                dispatch({
                    type: WikiTypes.RECEIVED_PAGE_STATUS,
                    data: {
                        postId: data.id,
                        status: pageStatus,
                    },
                });
            }

            return {data};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function getChannelDefaultWikiPage(channelId: string): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        try {
            const data = await Client4.getChannelDefaultWikiPage(channelId) as Post;

            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data,
            });

            return {data};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function deletePage(wikiId: string, pageId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            await Client4.deletePage(wikiId, pageId);

            dispatch({
                type: PostActionTypes.POST_DELETED,
                data: {id: pageId},
            });

            dispatch({
                type: WikiTypes.DELETED_PAGE,
                data: {id: pageId, wikiId},
            });

            return {data: true};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

// movePageParent changes the parent of a page without reordering.
// Use movePageInHierarchy from actions/pages.ts for drag-and-drop with optimistic updates.
export function movePageParent(wikiId: string, pageId: string, newParentId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            await Client4.movePage(wikiId, pageId, newParentId);
            return {data: true};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function movePageToWiki(sourceWikiId: string, pageId: string, targetWikiId: string, parentPageId?: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            await Client4.movePageToWiki(sourceWikiId, pageId, targetWikiId, parentPageId);
            return {data: true};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function duplicatePage(wikiId: string, pageId: string, targetWikiId?: string, parentPageId?: string): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        try {
            const duplicatedPage = await Client4.duplicatePage(wikiId, pageId, targetWikiId || wikiId, parentPageId);

            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data: duplicatedPage,
            });

            return {data: duplicatedPage};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error, {errorBarMode: LogErrorBarMode.Always}));
            return {error};
        }
    };
}

// Page Comments

export function getPageComments(wikiId: string, pageId: string): ActionFuncAsync<Post[]> {
    return async (dispatch, getState) => {
        try {
            const comments = await Client4.getPageComments(wikiId, pageId);

            if (comments && comments.length > 0) {
                const postsById = comments.reduce((acc: Record<string, Post>, comment: Post) => {
                    acc[comment.id] = comment;
                    return acc;
                }, {});

                dispatch({
                    type: PostActionTypes.RECEIVED_POSTS,
                    data: {
                        posts: postsById,
                    },
                });
            }

            return {data: comments};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function createPageComment(wikiId: string, pageId: string, message: string, inlineAnchor?: InlineAnchor): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        if (!message || message.trim() === '') {
            return {error: {message: 'Comment message cannot be empty'}};
        }

        try {
            const comment = await Client4.createPageComment(wikiId, pageId, message, inlineAnchor);
            return {data: comment};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function createPageCommentReply(wikiId: string, pageId: string, parentCommentId: string, message: string): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        if (!message || message.trim() === '') {
            return {error: {message: 'Reply message cannot be empty'}};
        }

        try {
            const reply = await Client4.createPageCommentReply(wikiId, pageId, parentCommentId, message);
            return {data: reply};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function resolvePageComment(wikiId: string, pageId: string, commentId: string): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        try {
            const resolvedComment = await Client4.resolvePageComment(wikiId, pageId, commentId);

            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data: resolvedComment,
            });

            return {data: resolvedComment};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function unresolvePageComment(wikiId: string, pageId: string, commentId: string): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        try {
            const unresolvedComment = await Client4.unresolvePageComment(wikiId, pageId, commentId);

            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data: unresolvedComment,
            });

            return {data: unresolvedComment};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

// Page Breadcrumb

export function getPageBreadcrumb(wikiId: string, pageId: string): ActionFuncAsync<BreadcrumbPath> {
    return async (dispatch, getState) => {
        try {
            const breadcrumb = await Client4.getPageBreadcrumb(wikiId, pageId);
            return {data: breadcrumb};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

// Page Status

export function getPageStatusField(): ActionFuncAsync {
    return async (dispatch) => {
        try {
            const field = await Client4.getPageStatusField();

            dispatch({
                type: WikiTypes.RECEIVED_PAGE_STATUS_FIELD,
                data: field,
            });

            return {data: field};
        } catch (error) {
            dispatch(logError(error));
            return {error};
        }
    };
}

export function getPageStatus(postId: string): ActionFuncAsync {
    return async (dispatch) => {
        try {
            const data = await Client4.getPageStatus(postId);

            dispatch({
                type: WikiTypes.RECEIVED_PAGE_STATUS,
                data: {
                    postId,
                    status: data.status,
                },
            });

            return {data};
        } catch (error) {
            dispatch(logError(error));
            return {error};
        }
    };
}

export function updatePageStatus(postId: string, status: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            await Client4.updatePageStatus(postId, status);

            const state = getState();
            const post = state.entities.posts.posts[postId];

            if (post) {
                const updatedPost = {
                    ...post,
                    props: {
                        ...post.props,
                        page_status: status,
                    },
                };

                dispatch({
                    type: PostActionTypes.RECEIVED_POST,
                    data: updatedPost,
                });
            }

            return {data: true};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

// Page Version History

export function getPageVersionHistory(wikiId: string, pageId: string): ActionFuncAsync<Post[]> {
    return async (dispatch, getState) => {
        try {
            const versionHistory = await Client4.getPageVersionHistory(wikiId, pageId);
            return {data: versionHistory};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

// Page Draft Operations

export function savePageDraft(
    wikiId: string,
    pageId: string,
    content: string,
    title?: string,
    lastUpdateAt?: number,
    additionalProps?: Record<string, unknown>,
): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            const serverDraft = await Client4.savePageDraft(wikiId, pageId, content, title, lastUpdateAt, additionalProps);
            return {data: serverDraft};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function getPageDraftsForWiki(wikiId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            const drafts = await Client4.getPageDraftsForWiki(wikiId);
            return {data: drafts};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function deletePageDraft(wikiId: string, pageId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            await Client4.deletePageDraft(wikiId, pageId);
            return {data: true};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function publishPageDraft(
    wikiId: string,
    pageId: string,
    pageParentId: string,
    title: string,
    searchText?: string,
    message?: string,
    pageStatus?: string,
    force?: boolean,
    baselineEditAt?: number,
): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        try {
            const data = await Client4.publishPageDraft(wikiId, pageId, pageParentId, title, searchText, message, pageStatus, force, baselineEditAt) as Post;

            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data,
            });

            dispatch({
                type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                data: {page: data, wikiId},
            });

            // Extract and store page status in Redux
            const publishedPageStatus = data.props?.page_status as string | undefined;
            if (publishedPageStatus) {
                dispatch({
                    type: WikiTypes.RECEIVED_PAGE_STATUS,
                    data: {
                        postId: data.id,
                        status: publishedPageStatus,
                    },
                });
            }

            return {data};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error, {errorBarMode: LogErrorBarMode.Always}));
            return {error};
        }
    };
}
