// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {matchPath} from 'react-router-dom';
import {batchActions} from 'redux-batched-actions';

import type {Post} from '@mattermost/types/posts';
import type {BreadcrumbPath, Wiki} from '@mattermost/types/wikis';

import {PostTypes as PostActionTypes, WikiTypes} from 'mattermost-redux/action_types';
import {logError, LogErrorBarMode} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {receivedNewPost} from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';
import {PostTypes} from 'mattermost-redux/constants/posts';
import {isCollapsedThreadsEnabled, syncedDraftsAreAllowedAndEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {getPageDraft, getUserDraftKeysForPage} from 'selectors/page_drafts';

import {loadPageDraftsForWiki} from 'actions/page_drafts';
import {setGlobalItem, removeGlobalItem} from 'actions/storage';
import {clearOutlineCache} from 'actions/views/pages_hierarchy';

import {getHistory} from 'utils/browser_history';
import {PageConstants, StoragePrefixes} from 'utils/constants';
import {extractPlaintextFromTipTapJSON} from 'utils/tiptap_utils';

import type {ActionFuncAsync} from 'types/store';
import type {PostDraft} from 'types/store/draft';

// Type alias: Pages are stored as Posts in the backend
export type Page = Post;

export const GET_PAGES_REQUEST = WikiTypes.GET_PAGES_REQUEST;
export const GET_PAGES_SUCCESS = WikiTypes.GET_PAGES_SUCCESS;
export const GET_PAGES_FAILURE = WikiTypes.GET_PAGES_FAILURE;

// Load all pages for a wiki
export function loadPages(wikiId: string): ActionFuncAsync<Post[]> {
    return async (dispatch, getState) => {
        dispatch({type: GET_PAGES_REQUEST, data: {wikiId}});

        try {
            const pages = await Client4.getPages(wikiId, 0, PageConstants.PAGE_FETCH_LIMIT);

            dispatch({
                type: GET_PAGES_SUCCESS,
                data: {wikiId, pages},
            });

            if (pages && pages.length > 0) {
                const state = getState();
                const existingPosts = state.entities.posts.posts;

                const postsToDispatch = pages.reduce((acc: Record<string, Post>, page: Post) => {
                    const existingPost = existingPosts[page.id];

                    // If page already exists in Redux with content, preserve the content
                    // GetWikiPages returns pages without content (for performance)
                    // Only full GetPage loads content from PageContents table
                    if (existingPost && existingPost.message && existingPost.message.trim() !== '') {
                        acc[page.id] = {
                            ...page,
                            message: existingPost.message,
                        };
                    } else {
                        acc[page.id] = page;
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
            dispatch(batchActions([
                {type: GET_PAGES_FAILURE, data: {wikiId, error}},
                logError(error),
            ]));
            return {error};
        }
    };
}

// Load all pages for a channel
export function loadChannelPages(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getChannelPages(channelId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: PostActionTypes.RECEIVED_POSTS,
            data,
            channelId,
        });

        return {data};
    };
}

// Load all wikis for a channel
export function loadChannelWikis(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            const wikis = await Client4.getChannelWikis(channelId);

            if (wikis && wikis.length > 0) {
                wikis.forEach((wiki) => {
                    dispatch({
                        type: WikiTypes.RECEIVED_WIKI,
                        data: wiki,
                    });
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

// Load single wiki and cache in Redux
export function loadWiki(wikiId: string): ActionFuncAsync<Wiki> {
    return async (dispatch, getState) => {
        const state = getState();
        const existingWiki = state.entities.wikis?.byId?.[wikiId];

        // Return cached wiki if it exists
        if (existingWiki) {
            return {data: existingWiki};
        }

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

// Update wiki properties (e.g., title)
export function updateWiki(wikiId: string, patch: {title?: string; description?: string}): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            // First fetch the current wiki
            const currentWiki = await Client4.getWiki(wikiId);

            // Apply the patch to the current wiki
            const updatedWiki = await Client4.updateWiki({
                ...currentWiki,
                ...patch,
            });

            dispatch({
                type: WikiTypes.RECEIVED_WIKI,
                data: updatedWiki,
            });

            dispatch({
                type: WikiTypes.INVALIDATE_PAGES,
                data: {wikiId},
            });

            return {data: updatedWiki};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

// Delete wiki
export function deleteWiki(wikiId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.deleteWiki(wikiId);

            dispatch({
                type: WikiTypes.DELETED_WIKI,
                data: {wikiId},
            });

            return {data: true};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error, {errorBarMode: LogErrorBarMode.Always}));
            return {error};
        }
    };
}

export function moveWikiToChannel(wikiId: string, targetChannelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            const wiki = await Client4.moveWikiToChannel(wikiId, targetChannelId);

            dispatch({
                type: WikiTypes.RECEIVED_WIKI,
                data: wiki,
            });

            return {data: wiki};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error, {errorBarMode: LogErrorBarMode.Always}));
            return {error};
        }
    };
}

// Load single page
export function loadPage(pageId: string, wikiId: string): ActionFuncAsync<Page> {
    return async (dispatch, getState) => {
        const state = getState();
        const existingPage = state.entities.posts.posts[pageId];

        // Return cached page if content already exists
        if (existingPage?.message?.trim()) {
            return {data: existingPage};
        }

        let data: Page;
        try {
            data = await Client4.getPage(wikiId, pageId) as Page;
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const actions: any[] = [
            {
                type: PostActionTypes.RECEIVED_POST,
                data,
            },
        ];

        // Extract and store page status in Redux
        const pageStatus = data.props?.page_status as string | undefined;
        if (pageStatus) {
            actions.push({
                type: WikiTypes.RECEIVED_PAGE_STATUS,
                data: {
                    postId: data.id,
                    status: pageStatus,
                },
            });
        }

        dispatch(batchActions(actions));

        return {data};
    };
}

// Load default page for a channel's wiki
export function loadChannelDefaultPage(channelId: string): ActionFuncAsync<Page> {
    return async (dispatch, getState) => {
        let data: Page;
        try {
            data = await Client4.getChannelDefaultWikiPage(channelId) as Page;
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: PostActionTypes.RECEIVED_POST,
            data,
        });

        return {data};
    };
}

// Publish a page draft
export function publishPageDraft(wikiId: string, draftId: string, pageParentId: string, title: string, searchText?: string, message?: string, pageStatus?: string, force?: boolean): ActionFuncAsync<Page> {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = state.entities.users.currentUserId;
        const draft = getPageDraft(state, wikiId, draftId);
        const draftKey = `${StoragePrefixes.PAGE_DRAFT}${wikiId}_${draftId}`;

        if (!draft) {
            return {error: {message: 'Draft not found'}};
        }

        // Check for conflicts (only if not forcing and editing existing page)
        const pageId = draft.props?.page_id as string | undefined;
        const baselineUpdateAt = draft.props?.original_page_update_at as number | undefined;

        if (!force && pageId && baselineUpdateAt) {
            try {
                const currentPage = await Client4.getPage(wikiId, pageId) as Page;

                // Compare as numbers to avoid type mismatch issues
                const currentUpdateAt = Number(currentPage.update_at);
                const baselineNum = Number(baselineUpdateAt);
                const isConflict = currentUpdateAt !== baselineNum;

                if (isConflict) {
                    return {
                        error: {
                            id: 'api.page.publish_draft.conflict',
                            message: 'Page was modified by another user',
                            status_code: 409,
                            data: {
                                currentPage,
                                baselineUpdateAt,
                            },
                        },
                    };
                }
            } catch (error) {
                // If page fetch fails, proceed with publish
                // (page might have been deleted, let server handle it)
            }
        }

        // Use passed message if provided (latest content from editor), otherwise fall back to draft.message
        const draftMessage = message === undefined ? (draft.message || '') : message;

        const pendingPageId = `pending-${Date.now()}`;
        const optimisticPage: Page = {
            id: pendingPageId,
            create_at: Date.now(),
            update_at: Date.now(),
            delete_at: 0,
            edit_at: 0,
            is_pinned: false,
            user_id: state.entities.users.currentUserId || '',
            channel_id: draft.channelId,
            root_id: '',
            original_id: '',
            page_parent_id: pageParentId || '',
            message: draftMessage,
            type: PostTypes.PAGE,
            props: {
                title: draft.props?.title || title || 'Untitled',
                page_parent_id: pageParentId || '',
            },
            hashtags: '',
            pending_post_id: pendingPageId,
            reply_count: 0,
            metadata: {
                embeds: [],
                emojis: [],
                files: [],
                images: {},
            },
        };

        // Remove draft from storage simultaneously with dispatching optimistic page
        // This prevents the race condition where both draft and optimistic page appear in tree
        const removeDraftAction = removeGlobalItem(draftKey);

        dispatch(batchActions([
            {type: WikiTypes.PUBLISH_DRAFT_REQUEST, data: {draftId}},
            {type: WikiTypes.RECEIVED_PAGE_IN_WIKI, data: {page: optimisticPage, wikiId}},
            {type: PostActionTypes.RECEIVED_POST, data: optimisticPage},
            removeDraftAction,
        ]));

        // Extract plaintext from TipTap JSON for search indexing (only when publishing)
        // Use passed searchText if provided, otherwise extract from message
        const finalSearchText = searchText === undefined ? extractPlaintextFromTipTapJSON(draftMessage) : searchText;

        // Use passed pageStatus if provided, otherwise extract from draft props
        const finalPageStatus = pageStatus || (draft.props?.page_status as string | undefined);

        try {
            const data = await Client4.publishPageDraft(wikiId, draftId, pageParentId, title, finalSearchText, draftMessage, finalPageStatus, force) as Page;

            const actions: any[] = [
                {type: WikiTypes.PUBLISH_DRAFT_SUCCESS, data: {draftId, pageId: data.id, optimisticId: pendingPageId}},
                {type: PostActionTypes.POST_REMOVED, data: {id: pendingPageId}},
                {type: PostActionTypes.RECEIVED_POST, data},
                {type: WikiTypes.RECEIVED_PAGE_IN_WIKI, data: {page: data, wikiId, pendingPageId}},
                {type: WikiTypes.DELETED_DRAFT, data: {id: draftId, wikiId}},
            ];

            // Extract and store page status in Redux
            const publishedPageStatus = data.props?.page_status as string | undefined;
            if (publishedPageStatus) {
                actions.push({
                    type: WikiTypes.RECEIVED_PAGE_STATUS,
                    data: {
                        postId: data.id,
                        status: publishedPageStatus,
                    },
                });
            }

            // Cleanup: Delete user's old drafts for this page
            const cleanupActions: any[] = [];
            if (pageId && currentUserId) {
                const draftKeys = getUserDraftKeysForPage(state, wikiId, pageId);
                draftKeys.forEach((key: string) => {
                    cleanupActions.push(removeGlobalItem(key));
                });
            }

            dispatch(batchActions([...actions, ...cleanupActions]));

            dispatch(removeGlobalItem(draftKey));

            const history = getHistory();
            const match = matchPath<{wikiId: string; draftId: string}>(history.location.pathname, {
                path: '/wikis/:wikiId/drafts/:draftId',
                exact: true,
            });
            if (match && match.params.draftId === draftId) {
                history.replace(`/wikis/${wikiId}/pages/${data.id}`);
            }

            // Clear outline cache for the published page so fresh headings are extracted
            dispatch(clearOutlineCache(data.id));

            // Invalidate both pages and drafts to trigger WikiView useEffect reload
            const timestamp = Date.now();
            dispatch(batchActions([
                {type: WikiTypes.INVALIDATE_PAGES, data: {wikiId, timestamp}},
                {type: WikiTypes.INVALIDATE_DRAFTS, data: {wikiId, timestamp}},
            ]));

            return {data};
        } catch (error: any) {
            dispatch(batchActions([
                {type: WikiTypes.PUBLISH_DRAFT_FAILURE, data: {draftId, error}},
                {type: PostActionTypes.POST_REMOVED, data: {id: pendingPageId}},
                {type: WikiTypes.DELETED_PAGE, data: {id: pendingPageId}},
            ]));
            dispatch(setGlobalItem(draftKey, draft));

            // Check if this is a conflict error (409 Conflict only, not 403)
            // 403 Forbidden is a permission error, not a concurrency conflict
            if (error?.status_code === 409 && pageId) {
                // Fetch the current page to get the latest version
                try {
                    const currentPage = await Client4.getPage(wikiId, pageId) as Page;
                    return {
                        error: {
                            id: 'api.page.publish_draft.conflict',
                            message: 'Page was modified by another user',
                            status_code: 409,
                            data: {
                                currentPage,
                                baselineUpdateAt,
                            },
                        },
                    };
                } catch (fetchError) {
                    // If we can't fetch the page, fall through to generic error handling
                }
            }

            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error, {errorBarMode: LogErrorBarMode.Always}));
            return {error};
        } finally {
            dispatch({type: WikiTypes.PUBLISH_DRAFT_COMPLETED, data: {draftId}});
        }
    };
}

// Create a new page draft
export function createPage(wikiId: string, title: string, pageParentId?: string): ActionFuncAsync<string> {
    return async (dispatch, getState) => {
        try {
            const draftId = `draft-${Date.now()}`;

            // Empty TipTap document JSON
            const placeholderContent = JSON.stringify({type: 'doc', content: []});

            await Client4.savePageDraft(wikiId, draftId, placeholderContent, title, undefined, {page_parent_id: pageParentId});

            await dispatch(loadPageDraftsForWiki(wikiId));

            return {data: draftId};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

// Update a page
export function updatePage(pageId: string, newTitle: string, wikiId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const originalPost = state.entities.posts.posts[pageId];

        if (!originalPost) {
            return {error: new Error('Page not found')};
        }

        const optimisticPost = {
            ...originalPost,
            props: {...originalPost.props, title: newTitle},
            update_at: Date.now(),
        };

        dispatch({
            type: PostActionTypes.RECEIVED_POST,
            data: optimisticPost,
        });

        try {
            const data = await Client4.patchPost({
                id: pageId,
                props: {title: newTitle},
            });

            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data,
            });

            const timestamp = Date.now();
            dispatch({
                type: WikiTypes.INVALIDATE_PAGES,
                data: {wikiId, timestamp},
            });

            return {data};
        } catch (error) {
            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data: originalPost,
            });

            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

// Delete a page
export function deletePage(pageId: string, wikiId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const originalPost = state.entities.posts.posts[pageId];

        dispatch(batchActions([
            {
                type: PostActionTypes.POST_DELETED,
                data: {id: pageId},
            },
            {
                type: WikiTypes.DELETED_PAGE,
                data: {id: pageId},
            },
        ]));

        try {
            await Client4.deletePage(wikiId, pageId);

            const timestamp = Date.now();
            dispatch({
                type: WikiTypes.INVALIDATE_PAGES,
                data: {wikiId, timestamp},
            });

            return {data: true};
        } catch (error) {
            if (originalPost) {
                dispatch(batchActions([
                    {
                        type: PostActionTypes.RECEIVED_POST,
                        data: originalPost,
                    },
                    {
                        type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                        data: {page: originalPost, wikiId},
                    },
                ]));
            }

            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

// Move a page (change parent)
export function movePage(pageId: string, newParentId: string, wikiId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const originalPost = state.entities.posts.posts[pageId];

        if (!originalPost) {
            return {error: new Error('Page not found')};
        }

        const optimisticPost = {
            ...originalPost,
            page_parent_id: newParentId || '',
            update_at: Date.now(),
        };

        dispatch({
            type: PostActionTypes.RECEIVED_POST,
            data: optimisticPost,
        });

        try {
            const data = await Client4.patchPost({
                id: pageId,
                page_parent_id: newParentId || '',
            });

            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data,
            });

            const timestamp = Date.now();
            dispatch({
                type: WikiTypes.INVALIDATE_PAGES,
                data: {wikiId, timestamp},
            });

            return {data};
        } catch (error) {
            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data: originalPost,
            });

            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

// Move a draft in hierarchy (used for drag-and-drop on drafts)
function moveDraftInHierarchy(draftId: string, newParentId: string | null, wikiId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const draft = getPageDraft(state, wikiId, draftId);

        if (!draft) {
            return {error: new Error('Draft not found')};
        }

        const updatedDraft: PostDraft = {
            ...draft,
            props: {
                ...draft.props,
                page_parent_id: newParentId || '',
            },
            updateAt: Date.now(),
        };

        const draftKey = `${StoragePrefixes.PAGE_DRAFT}${wikiId}_${draftId}`;
        dispatch(setGlobalItem(draftKey, updatedDraft));

        if (syncedDraftsAreAllowedAndEnabled(state)) {
            try {
                await Client4.savePageDraft(
                    wikiId,
                    draftId,
                    draft.message || '',
                    draft.props?.title || '',
                    undefined,
                    {page_parent_id: newParentId || ''},
                );
            } catch (error) {
                // Silently fail - draft will be updated on next save
            }
        }

        return {data: true};
    };
}

// Move a page in hierarchy (used for drag-and-drop)
export function movePageInHierarchy(pageId: string, newParentId: string | null, wikiId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        if (pageId.startsWith('draft-')) {
            return dispatch(moveDraftInHierarchy(pageId, newParentId, wikiId));
        }

        const state = getState();
        const originalPost = state.entities.posts.posts[pageId];

        if (!originalPost) {
            return {error: new Error('Page not found')};
        }

        const optimisticPost = {
            ...originalPost,
            page_parent_id: newParentId || '',
            props: {
                ...originalPost.props,
                page_parent_id: newParentId || '',
            },
            update_at: Date.now(),
        };

        dispatch({
            type: PostActionTypes.RECEIVED_POST,
            data: optimisticPost,
        });

        try {
            const patchData = {
                id: pageId,
                page_parent_id: newParentId || '',
            };
            const data = await Client4.patchPost(patchData);

            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data,
            });

            const timestamp = Date.now();
            dispatch({
                type: WikiTypes.INVALIDATE_PAGES,
                data: {wikiId, timestamp},
            });

            return {data};
        } catch (error) {
            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data: originalPost,
            });

            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

// Move a page to a different wiki
export function movePageToWiki(pageId: string, sourceWikiId: string, targetWikiId: string, parentPageId?: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.movePageToWiki(sourceWikiId, pageId, targetWikiId, parentPageId);

            const timestamp = Date.now();
            const isSameWiki = sourceWikiId === targetWikiId;

            if (isSameWiki) {
                dispatch({
                    type: WikiTypes.INVALIDATE_PAGES,
                    data: {wikiId: sourceWikiId, timestamp},
                });
            } else {
                dispatch(batchActions([
                    {type: WikiTypes.INVALIDATE_PAGES, data: {wikiId: sourceWikiId, timestamp}},
                    {type: WikiTypes.INVALIDATE_PAGES, data: {wikiId: targetWikiId, timestamp}},
                ]));
            }

            return {data: true};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function duplicatePage(pageId: string, wikiId: string): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        try {
            const duplicatedPage = await Client4.duplicatePage(wikiId, pageId, wikiId, undefined);

            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data: duplicatedPage,
            });

            const timestamp = Date.now();
            dispatch({
                type: WikiTypes.INVALIDATE_PAGES,
                data: {wikiId, timestamp},
            });

            return {data: duplicatedPage};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error, {errorBarMode: LogErrorBarMode.Always}));
            return {error};
        }
    };
}

export function publishPage(wikiId: string, pageId: string): ActionFuncAsync<Post> {
    return async () => {
        try {
            const data = await Client4.patchPost({
                id: pageId,
                type: PostTypes.PAGE,
            });
            return {data};
        } catch (error) {
            return {error};
        }
    };
}

export function getPageComments(wikiId: string, pageId: string): ActionFuncAsync<Post[]> {
    return async (dispatch, getState) => {
        try {
            const comments = await Client4.getPageComments(wikiId, pageId);

            // Dispatch comments to Redux store (they are Posts)
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

export function createPageComment(wikiId: string, pageId: string, message: string): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        try {
            const comment = await Client4.createPageComment(wikiId, pageId, message);

            const state = getState();
            const crtEnabled = isCollapsedThreadsEnabled(state);

            dispatch(receivedNewPost(comment, crtEnabled));

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
        try {
            const reply = await Client4.createPageCommentReply(wikiId, pageId, parentCommentId, message);

            const state = getState();
            const crtEnabled = isCollapsedThreadsEnabled(state);

            dispatch(receivedNewPost(reply, crtEnabled));

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

export function fetchPageStatusField(): ActionFuncAsync {
    return async (dispatch) => {
        try {
            const field = await Client4.getPageStatusField();

            dispatch({
                type: WikiTypes.RECEIVED_PAGE_STATUS_FIELD,
                data: field,
            });

            return {data: field};
        } catch (error) {
            return {error};
        }
    };
}

export function fetchPageStatus(postId: string): ActionFuncAsync {
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
            return {error};
        }
    };
}

export function updatePageStatus(postId: string, status: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.updatePageStatus(postId, status);

            // Update the post in the posts store with new status in props
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
            return {error};
        }
    };
}

export function getPageVersionHistory(wikiId: string, pageId: string): ActionFuncAsync<Post[]> {
    return async () => {
        try {
            const versionHistory = await Client4.getPageVersionHistory(wikiId, pageId);
            return {data: versionHistory};
        } catch (error) {
            return {error};
        }
    };
}
