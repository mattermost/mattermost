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
import {createWiki} from 'mattermost-redux/actions/wikis';
import {Client4} from 'mattermost-redux/client';
import {PostTypes} from 'mattermost-redux/constants/posts';
import {isCollapsedThreadsEnabled, syncedDraftsAreAllowedAndEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {loadPageDraftsForWiki} from 'actions/page_drafts';
import {setGlobalItem, removeGlobalItem} from 'actions/storage';
import {clearOutlineCache} from 'actions/views/pages_hierarchy';
import {getPageDraft, getUserDraftKeysForPage, makePageDraftKey} from 'selectors/page_drafts';

import {getHistory} from 'utils/browser_history';
import {PageConstants, PagePropsKeys} from 'utils/constants';
import {getPageReceiveActions} from 'utils/page_utils';
import {extractPlaintextFromTipTapJSON} from 'utils/tiptap_utils';

import type {ActionFuncAsync} from 'types/store';
import type {PostDraft} from 'types/store/draft';

export {createWiki};

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
            dispatch({type: GET_PAGES_FAILURE, data: {wikiId, error}});
            dispatch(logError(error));
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

export function loadPage(pageId: string, wikiId: string): ActionFuncAsync<Page> {
    return async (dispatch, getState) => {
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

            const actions: any[] = [
                {type: WikiTypes.PUBLISH_DRAFT_SUCCESS, data: {draftId, pageId: data.id, optimisticId: isFirstTimeDraft ? undefined : pendingPageId}},
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

            await dispatch(loadPageDraftsForWiki(wikiId));

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
// NOTE: This function doesn't have access to the autosave timeout from WikiView hooks.
// The autosave is scoped to the editor component, and drag-and-drop happens in the hierarchy panel.
// Since moves only update page_parent_id (not title/content), the race condition is less critical.
// The autosave will preserve the correct title/content and only the parent might briefly conflict.
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
                await Client4.savePageDraft(
                    wikiId,
                    draftId,
                    draft.message || '',
                    draft.props?.[PagePropsKeys.TITLE] || '',
                    0,
                    {[PagePropsKeys.PAGE_PARENT_ID]: newParentId || ''},
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
                [PagePropsKeys.PAGE_PARENT_ID]: newParentId || '',
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

// Move a page to a different wiki (or change parent within same wiki)
export function movePageToWiki(pageId: string, sourceWikiId: string, targetWikiId: string, parentPageId?: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const originalPost = state.entities.posts.posts[pageId];

        if (!originalPost) {
            return {error: new Error('Page not found')};
        }

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

        // Dispatch optimistic update immediately so UI reflects the change
        dispatch({
            type: PostActionTypes.RECEIVED_POST,
            data: optimisticPost,
        });

        try {
            await Client4.movePageToWiki(sourceWikiId, pageId, targetWikiId, parentPageId);

            // Dispatch again after API success to ensure Redux stays updated
            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data: optimisticPost,
            });

            return {data: true};
        } catch (error) {
            // Revert optimistic update on error
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
    context_before: string;
    context_after: string;
    node_path: string[];
    char_offset: number;
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
