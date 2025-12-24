// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {PageDraft as ServerPageDraft} from '@mattermost/types/drafts';

import {WikiTypes} from 'mattermost-redux/action_types';
import * as WikiActions from 'mattermost-redux/actions/wikis';
import {syncedDraftsAreAllowedAndEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {setGlobalItem, removeGlobalItem} from 'actions/storage';
import {setGlobalDraftSource, getDrafts} from 'actions/views/drafts';
import {makePageDraftKey, makePageDraftPrefix} from 'selectors/page_drafts';
import {getGlobalItem} from 'selectors/storage';

import type {ActionFuncAsync, GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

/**
 * LocalPageDraft is an internal type used for merging local and server drafts.
 * It wraps a PostDraft with storage key and timestamp for reconciliation.
 */
type LocalPageDraft = {
    key: keyof GlobalState['storage']['storage'];
    value: PostDraft;
    timestamp: Date;
};

export function transformPageServerDraft(serverDraft: ServerPageDraft, wikiId: string, pageId: string, userId: string): LocalPageDraft {
    const key = makePageDraftKey(wikiId, pageId, userId);

    return {
        key,
        timestamp: new Date(serverDraft.update_at),
        value: {
            message: JSON.stringify(serverDraft.content),
            fileInfos: [],
            props: {
                ...serverDraft.props,
                title: serverDraft.title,
                ...(serverDraft.file_ids && {file_ids: serverDraft.file_ids}),
                has_published_version: serverDraft.has_published_version,
            },
            uploadsInProgress: [],
            channelId: '',
            wikiId: serverDraft.wiki_id || wikiId,
            rootId: pageId,
            createAt: serverDraft.create_at,
            updateAt: serverDraft.update_at,
            show: true,
        },
    };
}

export function savePageDraft(
    channelId: string,
    wikiId: string,
    pageId: string,
    message: string,
    title?: string,
    lastUpdateAt?: number,
    additionalProps?: Record<string, unknown>,
): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const key = makePageDraftKey(wikiId, pageId, currentUserId);

        const timestamp = new Date().getTime();
        const existingDraft = getGlobalItem<Partial<PostDraft>>(state, key, {});

        const draft: PostDraft = {
            message,
            fileInfos: [],
            uploadsInProgress: [],
            channelId,
            wikiId,
            rootId: pageId,
            props: {
                ...existingDraft.props,
                ...additionalProps,
                title: title || '',
            },
            createAt: existingDraft.createAt || timestamp,
            updateAt: timestamp,
            show: true,
        };

        dispatch(batchActions([
            setGlobalItem(key, draft),
            setGlobalDraftSource(key, false),
        ]));

        if (syncedDraftsAreAllowedAndEnabled(state)) {
            // Delegate to Redux layer for the API call
            const result = await dispatch(WikiActions.savePageDraft(wikiId, pageId, message, title, lastUpdateAt, additionalProps));

            if (!result.error && result.data) {
                const serverDraft = result.data as ServerPageDraft;
                const transformedDraft = transformPageServerDraft(serverDraft, wikiId, pageId, currentUserId);

                dispatch(batchActions([
                    setGlobalItem(key, transformedDraft.value),
                    setGlobalDraftSource(key, true),
                ]));
            } else if (result.error) {
                return {data: false, error: result.error};
            }
        }

        return {data: true};
    };
}

export function fetchPageDraft(wikiId: string, pageId: string): ActionFuncAsync<PostDraft | null> {
    return async (_dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const key = makePageDraftKey(wikiId, pageId, currentUserId);
        const storedDraft = state.storage.storage[key];

        if (storedDraft && storedDraft.value) {
            return {data: storedDraft.value as PostDraft};
        }

        return {data: null};
    };
}

export function fetchPageDraftsForWiki(wikiId: string): ActionFuncAsync<PostDraft[]> {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);

        let serverDrafts: LocalPageDraft[] = [];
        if (syncedDraftsAreAllowedAndEnabled(state)) {
            // Delegate to Redux layer for the API call
            const result = await dispatch(WikiActions.getPageDraftsForWiki(wikiId));
            if (!result.error && result.data) {
                const serverDraftsRaw = result.data as ServerPageDraft[];
                serverDrafts = serverDraftsRaw.map((draft) => transformPageServerDraft(draft, wikiId, draft.page_id, currentUserId));
            }
        }

        const prefix = makePageDraftPrefix(wikiId);
        const localDrafts: LocalPageDraft[] = [];

        Object.keys(state.storage.storage).forEach((key) => {
            // Only include drafts for the current user
            if (key.startsWith(prefix) && key.endsWith(`_${currentUserId}`)) {
                const storedDraft = state.storage.storage[key];
                if (storedDraft && storedDraft.value) {
                    const draft = storedDraft.value as PostDraft;
                    localDrafts.push({
                        key,
                        timestamp: new Date(draft.updateAt || 0),
                        value: draft,
                    });
                }
            }
        });

        const drafts = [...serverDrafts, ...localDrafts];

        const draftsMap = new Map<string, LocalPageDraft>();
        drafts.forEach((draft) => {
            const existing = draftsMap.get(draft.key);
            if (!existing || draft.timestamp > existing.timestamp) {
                draftsMap.set(draft.key, draft);
            }
        });

        const actions = Array.from(draftsMap).map(([key, draft]) => {
            return setGlobalItem(key, draft.value);
        });

        dispatch(batchActions(actions));

        const resultDrafts = Array.from(draftsMap.values()).map((d) => d.value);
        return {data: resultDrafts};
    };
}

export function removePageDraft(wikiId: string, pageId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const key = makePageDraftKey(wikiId, pageId, currentUserId);

        // Delete from server first (if sync is enabled) - delegate to Redux layer
        if (syncedDraftsAreAllowedAndEnabled(state)) {
            await dispatch(WikiActions.deletePageDraft(wikiId, pageId));

            // Still remove from local storage even if server delete fails
            // This prevents the draft from being stuck in UI
        }

        // Remove from local storage and notify Redux
        dispatch(batchActions([
            removeGlobalItem(key),
            {type: WikiTypes.DELETED_DRAFT, data: {id: pageId, wikiId, userId: currentUserId}},
        ]));

        return {data: true};
    };
}

export function clearPageDraft(wikiId: string, pageId: string): ActionFuncAsync<boolean> {
    return async (dispatch) => {
        return dispatch(removePageDraft(wikiId, pageId));
    };
}

export function syncPageDraftsWithServer(wikiId: string): ActionFuncAsync<boolean> {
    return async (dispatch) => {
        return dispatch(getDrafts(wikiId));
    };
}
