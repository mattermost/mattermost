// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';

import type {Post} from '@mattermost/types/posts';
import type {BreadcrumbPath, Wiki} from '@mattermost/types/wikis';

import {PostTypes as PostActionTypes, WikiTypes} from 'mattermost-redux/action_types';
import {logError, LogErrorBarMode} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {receivedNewPost} from 'mattermost-redux/actions/posts';
import {createWiki} from 'mattermost-redux/actions/wikis';
import {Client4} from 'mattermost-redux/client';
import {PostTypes} from 'mattermost-redux/constants/posts';
import {isCollapsedThreadsEnabled, syncedDraftsAreAllowedAndEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {fetchPageDraftsForWiki} from 'actions/page_drafts';
import {setGlobalItem, removeGlobalItem} from 'actions/storage';
import {clearOutlineCache} from 'actions/views/pages_hierarchy';
import {getPageDraft, getUserDraftKeysForPage, makePageDraftKey} from 'selectors/page_drafts';
import {getWiki} from 'selectors/pages';

import {PageConstants, PagePropsKeys} from 'utils/constants';
import {getPageReceiveActions} from 'utils/page_utils';
import {extractPlaintextFromTipTapJSON} from 'utils/tiptap_utils';

import type {ActionFuncAsync, DispatchFunc, GetStateFunc} from 'types/store';
import type {PostDraft} from 'types/store/draft';
import type {Page} from 'types/store/pages';

/**
 * handleApiError handles the common error handling pattern for API calls.
 * This includes forcing logout if necessary and logging the error.
 *
 * @param error - The error from the API call
 * @param dispatch - Redux dispatch function
 * @param getState - Redux getState function
 * @param options - Optional configuration
 * @param options.showErrorBar - Whether to always show the error bar (default: false)
 */
function handleApiError(
    error: unknown,
    dispatch: DispatchFunc,
    getState: GetStateFunc,
    options?: {showErrorBar?: boolean},
): void {
    // Cast to any to match existing error handling patterns in the codebase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;
    forceLogoutIfNecessary(err, dispatch, getState);
    if (options?.showErrorBar) {
        dispatch(logError(err, {errorBarMode: LogErrorBarMode.Always}));
    } else {
        dispatch(logError(err));
    }
}

export {createWiki};

export type {Page} from 'types/store/pages';

export const GET_PAGES_REQUEST = WikiTypes.GET_PAGES_REQUEST;
export const GET_PAGES_SUCCESS = WikiTypes.GET_PAGES_SUCCESS;
export const GET_PAGES_FAILURE = WikiTypes.GET_PAGES_FAILURE;

// Fetch all pages for a wiki (with automatic pagination)
export function fetchPages(wikiId: string): ActionFuncAsync<Post[]> {
    return async (dispatch, getState) => {
        dispatch({type: GET_PAGES_REQUEST, data: {wikiId}});

        try {
            // Fetch all pages by paginating until we get fewer results than the limit
            const allPages: Post[] = [];
            let offset = 0;
            const limit = PageConstants.PAGE_FETCH_LIMIT;
            let hasMore = true;

            while (hasMore) {
                // eslint-disable-next-line no-await-in-loop
                const batch = await Client4.getPages(wikiId, offset, limit);

                if (batch && batch.length > 0) {
                    allPages.push(...batch);
                }

                // If we got fewer pages than the limit, we've reached the end
                if (!batch || batch.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            }

            dispatch({
                type: GET_PAGES_SUCCESS,
                data: {wikiId, pages: allPages},
            });

            if (allPages.length > 0) {
                const state = getState();
                const existingPosts = state.entities.posts.posts;

                const postsToDispatch = allPages.reduce((acc: Record<string, Post>, page: Post) => {
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

            return {data: allPages};
        } catch (error) {
            handleApiError(error, dispatch, getState);
            dispatch({type: GET_PAGES_FAILURE, data: {wikiId, error}});
            return {error};
        }
    };
}

// Fetch all pages for a channel
export function fetchChannelPages(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getChannelPages(channelId);
        } catch (error) {
            handleApiError(error, dispatch, getState);
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

// Fetch all wikis for a channel
export function fetchChannelWikis(channelId: string): ActionFuncAsync {
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

// Fetch single wiki and cache in Redux
export function fetchWiki(wikiId: string): ActionFuncAsync<Wiki> {
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

export function fetchPage(pageId: string, wikiId: string): ActionFuncAsync<Page> {
    return async (dispatch, getState) => {
        let data: Page;
        try {
            data = await Client4.getPage(wikiId, pageId) as Page;
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const actions: AnyAction[] = [
            {
                type: PostActionTypes.RECEIVED_POST,
                data,
            },
        ];

        const pageStatus = data.props?.[PagePropsKeys.PAGE_STATUS] as string | undefined;
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

// Fetch default page for a channel's wiki
export function fetchChannelDefaultPage(channelId: string): ActionFuncAsync<Page> {
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
        const wiki = getWiki(state, wikiId);
        const draftKey = makePageDraftKey(wikiId, draftId, currentUserId);

        if (!draft) {
            return {error: {message: 'Draft not found'}};
        }

        // Get pageId and baseEditAt for server-side conflict detection (optimistic locking)
        // The server compares baseEditAt against the page's current edit_at to detect conflicts
        const pageId = draft.props?.[PagePropsKeys.PAGE_ID] as string | undefined;
        const baseEditAt = draft.props?.[PagePropsKeys.ORIGINAL_PAGE_EDIT_AT] as number | undefined;

        // Use passed message if provided (latest content from editor), otherwise fall back to draft.message
        const draftMessage = message === undefined ? (draft.message || '') : message;

        // Get channel_id from wiki (draft.channelId may be empty due to server transform setting it to '')
        const channelId = wiki?.channel_id || draft.channelId || '';

        const pendingPageId = `pending-${Date.now()}`;
        const optimisticPage: Page = {
            id: pendingPageId,
            create_at: Date.now(),
            update_at: Date.now(),
            delete_at: 0,
            edit_at: 0,
            is_pinned: false,
            user_id: state.entities.users.currentUserId || '',
            channel_id: channelId,
            root_id: '',
            original_id: '',
            page_parent_id: pageParentId || '',
            message: draftMessage,
            type: PostTypes.PAGE,
            props: {
                [PagePropsKeys.TITLE]: draft.props?.[PagePropsKeys.TITLE] || title || 'Untitled',
                [PagePropsKeys.PAGE_PARENT_ID]: pageParentId || '',
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

        // Remove draft from storage
        const removeDraftAction = removeGlobalItem(draftKey);

        // For first-time drafts (no existing pageId), skip optimistic page insertion.
        // This avoids the flicker where pending-* node appears then disappears.
        // The real page will be added when the server responds.
        const isFirstTimeDraft = !pageId;

        if (isFirstTimeDraft) {
            dispatch(batchActions([
                {type: WikiTypes.PUBLISH_DRAFT_REQUEST, data: {draftId}},
                removeDraftAction,
            ]));
        } else {
            // For edits of existing pages, use optimistic update
            dispatch(batchActions([
                {type: WikiTypes.PUBLISH_DRAFT_REQUEST, data: {draftId}},
                {type: WikiTypes.RECEIVED_PAGE_IN_WIKI, data: {page: optimisticPage, wikiId}},
                {type: PostActionTypes.RECEIVED_POST, data: optimisticPage},
                removeDraftAction,
            ]));
        }

        // Extract plaintext from TipTap JSON for search indexing (only when publishing)
        // Use passed searchText if provided, otherwise extract from message
        const finalSearchText = searchText === undefined ? extractPlaintextFromTipTapJSON(draftMessage) : searchText;

        // Use passed pageStatus if provided, otherwise extract from draft props
        const finalPageStatus = pageStatus || (draft.props?.[PagePropsKeys.PAGE_STATUS] as string | undefined);

        try {
            const data = await Client4.publishPageDraft(wikiId, draftId, pageParentId, title, finalSearchText, draftMessage, finalPageStatus, force, baseEditAt) as Page;

            const actions: AnyAction[] = [
                {type: WikiTypes.PUBLISH_DRAFT_SUCCESS, data: {draftId, pageId: data.id, publishedAt: data.update_at, optimisticId: isFirstTimeDraft ? undefined : pendingPageId}},
                {type: PostActionTypes.RECEIVED_POST, data},
                {type: WikiTypes.RECEIVED_PAGE_IN_WIKI, data: {page: data, wikiId, pendingPageId: isFirstTimeDraft ? undefined : pendingPageId}},
                {type: WikiTypes.DELETED_DRAFT, data: {id: draftId, wikiId}},
            ];

            // Only remove optimistic page if it was created (not first-time drafts)
            if (!isFirstTimeDraft) {
                actions.splice(1, 0, {type: PostActionTypes.POST_REMOVED, data: {id: pendingPageId}});
            }

            // Extract and store page status in Redux
            const publishedPageStatus = data.props?.[PagePropsKeys.PAGE_STATUS] as string | undefined;
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
            const cleanupActions: AnyAction[] = [];
            if (pageId && currentUserId) {
                const draftKeys = getUserDraftKeysForPage(state, wikiId, pageId);
                draftKeys.forEach((key: string) => {
                    cleanupActions.push(removeGlobalItem(key));
                });
            }

            dispatch(batchActions([...actions, ...cleanupActions]));

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
            // Use pageId from draft props, or fall back to draftId (unified page ID model)
            // In unified model, draftId IS the page ID when editing an existing page
            const conflictPageId = pageId || draftId;
            if (error?.status_code === 409 && conflictPageId) {
                // Fetch the current page to get the latest version
                try {
                    const currentPage = await Client4.getPage(wikiId, conflictPageId) as Page;
                    return {
                        error: {
                            id: 'api.page.publish_draft.conflict',
                            message: 'Page was modified by another user',
                            status_code: 409,
                            data: {
                                currentPage,
                                baseEditAt,
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
            const pageDraft = await Client4.createPageDraft(wikiId, title, pageParentId);

            await dispatch(fetchPageDraftsForWiki(wikiId));

            return {data: pageDraft.page_id};
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
            props: {...originalPost.props, [PagePropsKeys.TITLE]: newTitle},
            update_at: Date.now(),
        };

        dispatch({
            type: PostActionTypes.RECEIVED_POST,
            data: optimisticPost,
        });

        try {
            const data = await Client4.updatePage(wikiId, pageId, newTitle);

            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data,
            });

            const pageActions = getPageReceiveActions(data);
            pageActions.forEach((action) => dispatch(action));

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

// Move a draft in hierarchy (used for drag-and-drop on drafts)
// Uses a dedicated move endpoint that only updates page_parent_id prop,
// avoiding race conditions with concurrent content autosave operations.
function moveDraftInHierarchy(draftId: string, newParentId: string | null, wikiId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = state.entities.users.currentUserId;
        const draft = getPageDraft(state, wikiId, draftId);

        if (!draft) {
            return {error: new Error('Draft not found')};
        }

        const updatedDraft: PostDraft = {
            ...draft,
            props: {
                ...draft.props,
                [PagePropsKeys.PAGE_PARENT_ID]: newParentId || '',
            },
            updateAt: Date.now(),
        };

        const draftKey = makePageDraftKey(wikiId, draftId, currentUserId);
        dispatch(setGlobalItem(draftKey, updatedDraft));

        if (syncedDraftsAreAllowedAndEnabled(state)) {
            try {
                await Client4.movePageDraft(wikiId, draftId, newParentId || '');
            } catch (error) {
                // Local state has been updated; next autosave will sync.
                // Still log error for debugging purposes.
                dispatch(logError(error));
            }
        }

        return {data: true};
    };
}

// Move a page in hierarchy (used for drag-and-drop)
// Uses the dedicated /parent endpoint which broadcasts page_moved WebSocket event
// to ensure all clients update their hierarchy view
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
                [PagePropsKeys.PAGE_PARENT_ID]: newParentId || '',
            },
            update_at: Date.now(),
        };

        dispatch({
            type: PostActionTypes.RECEIVED_POST,
            data: optimisticPost,
        });

        try {
            // Use the dedicated updatePageParent endpoint instead of patchPost.
            // This endpoint broadcasts the page_moved WebSocket event, ensuring
            // all connected clients update their hierarchy view.
            await Client4.updatePageParent(wikiId, pageId, newParentId || '');

            const timestamp = Date.now();
            dispatch({
                type: WikiTypes.INVALIDATE_PAGES,
                data: {wikiId, timestamp},
            });

            return {data: optimisticPost};
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

// Move a page to a different wiki (or change parent within same wiki)
export function movePageToWiki(pageId: string, sourceWikiId: string, targetWikiId: string, parentPageId?: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const originalPost = state.entities.posts.posts[pageId];

        if (!originalPost) {
            return {error: new Error('Page not found')};
        }

        const isCrossWikiMove = sourceWikiId !== targetWikiId;

        // Create optimistic update with new parent
        const optimisticPost: Post = {
            ...originalPost,
            page_parent_id: parentPageId || '',
            props: {
                ...originalPost.props,
                [PagePropsKeys.PAGE_PARENT_ID]: parentPageId || '',
            },
            update_at: Date.now(),
        };

        // Build optimistic actions
        const optimisticActions: AnyAction[] = [
            {
                type: PostActionTypes.RECEIVED_POST,
                data: optimisticPost,
            },
        ];

        // For cross-wiki moves, update both source and target wiki page lists
        if (isCrossWikiMove) {
            optimisticActions.push(
                {
                    type: WikiTypes.REMOVED_PAGE_FROM_WIKI,
                    data: {pageId, wikiId: sourceWikiId},
                },
                {
                    type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                    data: {page: optimisticPost, wikiId: targetWikiId},
                },
            );
        }

        // Dispatch optimistic update immediately so UI reflects the change
        dispatch(batchActions(optimisticActions));

        try {
            await Client4.movePageToWiki(sourceWikiId, pageId, targetWikiId, parentPageId);

            return {data: true};
        } catch (error) {
            // Revert optimistic update on error
            const revertActions: AnyAction[] = [
                {
                    type: PostActionTypes.RECEIVED_POST,
                    data: originalPost,
                },
            ];

            // Revert cross-wiki changes
            if (isCrossWikiMove) {
                revertActions.push(
                    {
                        type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                        data: {page: originalPost, wikiId: sourceWikiId},
                    },
                    {
                        type: WikiTypes.REMOVED_PAGE_FROM_WIKI,
                        data: {pageId, wikiId: targetWikiId},
                    },
                );
            }

            dispatch(batchActions(revertActions));

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
    return async (dispatch, getState) => {
        try {
            const data = await Client4.patchPost({
                id: pageId,
                type: PostTypes.PAGE,
            });
            return {data};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
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

type InlineAnchor = {
    text: string;
    anchor_id: string;
};

export function createPageComment(wikiId: string, pageId: string, message: string, inlineAnchor?: InlineAnchor): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        try {
            const comment = await Client4.createPageComment(wikiId, pageId, message, inlineAnchor);

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
    return async (dispatch, getState) => {
        try {
            const field = await Client4.getPageStatusField();

            dispatch({
                type: WikiTypes.RECEIVED_PAGE_STATUS_FIELD,
                data: field,
            });

            return {data: field};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function fetchPageStatus(postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
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
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
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
                        [PagePropsKeys.PAGE_STATUS]: status,
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

const STALE_PUBLISHED_DRAFT_THRESHOLD_MS = 5 * 60 * 1000;

export function cleanupPublishedDraftTimestamps(): ActionFuncAsync {
    return async (dispatch) => {
        const staleThreshold = Date.now() - STALE_PUBLISHED_DRAFT_THRESHOLD_MS;

        dispatch({
            type: WikiTypes.CLEANUP_PUBLISHED_DRAFT_TIMESTAMPS,
            data: {staleThreshold},
        });

        return {data: true};
    };
}

export interface TranslationReference {
    page_id: string;
    language_code: string;
}

/**
 * Set translation metadata on a translated page.
 * Links the translated page back to its source.
 */
export function setPageTranslationMetadata(
    pageId: string,
    sourcePageId: string,
    languageCode: string,
): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        try {
            const state = getState();
            const page = state.entities.posts.posts[pageId];
            const props = page?.props || {};

            const data = await Client4.patchPost({
                id: pageId,
                props: {
                    ...props,
                    [PagePropsKeys.TRANSLATED_FROM]: sourcePageId,
                    [PagePropsKeys.TRANSLATION_LANGUAGE]: languageCode,
                },
            });

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

/**
 * Add a translation reference to a source page's translations array.
 * Called when a new translation is created to link the source to its translation.
 */
export function addPageTranslationReference(
    sourcePageId: string,
    translatedPageId: string,
    languageCode: string,
): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        try {
            const state = getState();
            const sourcePage = state.entities.posts.posts[sourcePageId];
            const existingProps = sourcePage?.props || {};
            const existingTranslations = (existingProps[PagePropsKeys.TRANSLATIONS] || []) as TranslationReference[];

            const newTranslationRef: TranslationReference = {
                page_id: translatedPageId,
                language_code: languageCode,
            };

            // Replace any existing translation for the same language
            const updatedTranslations = [
                ...existingTranslations.filter((t) => t.language_code !== languageCode),
                newTranslationRef,
            ];

            const data = await Client4.patchPost({
                id: sourcePageId,
                props: {
                    ...existingProps,
                    [PagePropsKeys.TRANSLATIONS]: updatedTranslations,
                },
            });

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
