// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import {Mention} from '@tiptap/extension-mention';
import StarterKit from '@tiptap/starter-kit';
import {matchPath} from 'react-router-dom';
import {batchActions} from 'redux-batched-actions';

import type {Post} from '@mattermost/types/posts';

import {PostTypes as PostActionTypes, WikiTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {receivedNewPost} from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';
import {PostTypes} from 'mattermost-redux/constants/posts';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {getHistory} from 'utils/browser_history';

import type {ActionFuncAsync} from 'types/store';
import type {PostDraft} from 'types/store/draft';

// Type alias: Pages are stored as Posts in the backend
export type Page = Post;

/**
 * Extract plaintext from TipTap JSON for search indexing.
 * Only called when publishing a page (not on draft saves).
 */
function extractPlaintextFromTipTapJSON(jsonString: string): string {
    if (!jsonString || jsonString.trim() === '') {
        return '';
    }

    try {
        const jsonContent = JSON.parse(jsonString);

        // Create a temporary editor to extract text
        const tempEditor = new Editor({
            extensions: [
                StarterKit,
                Mention.configure({
                    HTMLAttributes: {
                        class: 'mention',
                    },
                }),
            ],
            content: jsonContent,
            editable: false,
        });

        const plaintext = tempEditor.getText({blockSeparator: '\n\n'});
        tempEditor.destroy();

        return plaintext;
    } catch (error) {
        return '';
    }
}

export const GET_WIKI_PAGES_REQUEST = WikiTypes.GET_WIKI_PAGES_REQUEST;
export const GET_WIKI_PAGES_SUCCESS = WikiTypes.GET_WIKI_PAGES_SUCCESS;
export const GET_WIKI_PAGES_FAILURE = WikiTypes.GET_WIKI_PAGES_FAILURE;

// Load all pages for a wiki
export function loadWikiPages(wikiId: string): ActionFuncAsync<Post[]> {
    return async (dispatch, getState) => {
        dispatch({type: GET_WIKI_PAGES_REQUEST, data: {wikiId}});

        try {
            const pages = await Client4.getWikiPages(wikiId, 0, 100);

            dispatch({
                type: GET_WIKI_PAGES_SUCCESS,
                data: {wikiId, pages},
            });

            if (pages && pages.length > 0) {
                dispatch({
                    type: WikiTypes.RECEIVED_PAGE_SUMMARIES,
                    data: {wikiId, pages},
                });

                dispatch({
                    type: PostActionTypes.RECEIVED_POSTS,
                    data: {
                        posts: pages.reduce((acc: Record<string, Post>, page: Post) => {
                            acc[page.id] = page;
                            return acc;
                        }, {}),
                    },
                });
            }

            return {data: pages};
        } catch (error) {
            dispatch({type: GET_WIKI_PAGES_FAILURE, data: {wikiId, error}});
            forceLogoutIfNecessary(error, dispatch, getState);
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

// Load single page
export function loadPage(pageId: string, wikiId: string): ActionFuncAsync<Page> {
    return async (dispatch, getState) => {
        let data: Page;
        try {
            data = await Client4.getWikiPage(wikiId, pageId) as Page;
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: WikiTypes.RECEIVED_FULL_PAGE,
            data,
        });

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
export function publishPageDraft(wikiId: string, draftId: string, pageParentId: string, title: string): ActionFuncAsync<Page> {
    return async (dispatch, getState) => {
        const {makePageDraftKey} = await import('./page_drafts');
        const {getGlobalItem} = await import('selectors/storage');
        const {removeGlobalItem} = await import('actions/storage');

        const state = getState();
        const draftKey = makePageDraftKey(wikiId, draftId);
        const draft = getGlobalItem<PostDraft | null>(state, draftKey, null);

        if (!draft) {
            return {error: {message: 'Draft not found'}};
        }

        const pendingPageId = `pending-${Date.now()}`;
        const optimisticPage: Page = {
            id: pendingPageId,
            create_at: Date.now(),
            update_at: Date.now(),
            delete_at: 0,
            edit_at: 0,
            is_pinned: false,
            user_id: state.entities.users.currentUserId || '',
            channel_id: wikiId,
            root_id: '',
            original_id: '',
            page_parent_id: pageParentId || '',
            message: draft.message || '',
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

        dispatch(removeGlobalItem(draftKey));

        dispatch(batchActions([
            {type: WikiTypes.PUBLISH_DRAFT_REQUEST, data: {draftId}},
            {type: WikiTypes.RECEIVED_PAGE, data: optimisticPage},
            {type: WikiTypes.DELETED_DRAFT, data: {id: draftId, wikiId}},
        ]));

        // Extract plaintext from TipTap JSON for search indexing (only when publishing)
        const searchText = extractPlaintextFromTipTapJSON(draft.message || '');

        try {
            const data = await Client4.publishPageDraft(wikiId, draftId, pageParentId, title, searchText) as Page;

            dispatch(batchActions([
                {type: WikiTypes.PUBLISH_DRAFT_SUCCESS, data: {draftId, pageId: data.id, optimisticId: pendingPageId}},
                {type: WikiTypes.RECEIVED_PAGE, data: {...data, optimisticId: pendingPageId}},
            ]));

            const history = getHistory();
            const match = matchPath<{wikiId: string; draftId: string}>(history.location.pathname, {
                path: '/wikis/:wikiId/drafts/:draftId',
                exact: true,
            });
            if (match && match.params.draftId === draftId) {
                history.replace(`/wikis/${wikiId}/pages/${data.id}`);
            }

            await dispatch(loadWikiPages(wikiId));

            return {data};
        } catch (error) {
            const {setGlobalItem} = await import('actions/storage');
            dispatch(batchActions([
                {type: WikiTypes.PUBLISH_DRAFT_FAILURE, data: {draftId, error}},
                {type: WikiTypes.DELETED_PAGE, data: {id: pendingPageId}},
            ]));
            dispatch(setGlobalItem(draftKey, draft));

            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        } finally {
            dispatch({type: WikiTypes.PUBLISH_DRAFT_COMPLETED, data: {draftId}});
        }
    };
}

// Create a new page draft
export function createPage(wikiId: string, title: string, pageParentId?: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            const draftId = `draft-${Date.now()}`;
            const placeholderContent = '';

            const draft = await Client4.savePageDraft(wikiId, draftId, placeholderContent, title, undefined, {page_parent_id: pageParentId});

            const {loadPageDraftsForWiki} = await import('./page_drafts');
            await dispatch(loadPageDraftsForWiki(wikiId));

            return {data: draft};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

// Rename a page
export function renamePage(pageId: string, newTitle: string, wikiId: string): ActionFuncAsync {
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

        dispatch({
            type: WikiTypes.RECEIVED_PAGE,
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

            dispatch({
                type: WikiTypes.RECEIVED_PAGE,
                data,
            });

            await dispatch(loadWikiPages(wikiId));

            return {data};
        } catch (error) {
            dispatch({
                type: PostActionTypes.RECEIVED_POST,
                data: originalPost,
            });

            dispatch({
                type: WikiTypes.RECEIVED_PAGE,
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
            await Client4.deletePost(pageId);

            await dispatch(loadWikiPages(wikiId));

            return {data: true};
        } catch (error) {
            if (originalPost) {
                dispatch(batchActions([
                    {
                        type: PostActionTypes.RECEIVED_POST,
                        data: originalPost,
                    },
                    {
                        type: WikiTypes.RECEIVED_PAGE,
                        data: originalPost,
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

            await dispatch(loadWikiPages(wikiId));

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
