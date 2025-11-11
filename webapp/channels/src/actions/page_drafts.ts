// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {PageDraft as ServerPageDraft} from '@mattermost/types/drafts';

import {WikiTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {syncedDraftsAreAllowedAndEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {setGlobalItem, removeGlobalItem} from 'actions/storage';
import {setGlobalDraftSource, getDrafts} from 'actions/views/drafts';
import {getGlobalItem} from 'selectors/storage';

import {StoragePrefixes} from 'utils/constants';

import type {ActionFuncAsync, GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

type PageDraft = {
    key: keyof GlobalState['storage']['storage'];
    value: PostDraft;
    timestamp: Date;
};

export function makePageDraftKey(wikiId: string, draftId: string): string {
    return `${StoragePrefixes.PAGE_DRAFT}${wikiId}_${draftId}`;
}

export function transformPageServerDraft(serverDraft: ServerPageDraft, wikiId: string, draftId: string): PageDraft {
    const key = makePageDraftKey(wikiId, draftId);

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
            },
            uploadsInProgress: [],
            channelId: '',
            wikiId: serverDraft.wiki_id || wikiId,
            rootId: draftId,
            createAt: serverDraft.create_at,
            updateAt: serverDraft.update_at,
            show: true,
        },
    };
}

export function savePageDraft(
    channelId: string,
    wikiId: string,
    draftId: string,
    message: string,
    title?: string,
    pageId?: string,
    additionalProps?: Record<string, any>,
): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        const state = getState();
        const key = makePageDraftKey(wikiId, draftId);

        const timestamp = new Date().getTime();
        const existingDraft = getGlobalItem<Partial<PostDraft>>(state, key, {});

        const draft: PostDraft = {
            message,
            fileInfos: [],
            uploadsInProgress: [],
            channelId,
            wikiId,
            rootId: draftId,
            props: {
                ...existingDraft.props,
                ...additionalProps,
                title: title || '',
                ...(pageId && {page_id: pageId}),
            },
            createAt: existingDraft.createAt || timestamp,
            updateAt: timestamp,
            show: true,
        };

        dispatch(setGlobalItem(key, draft));
        dispatch(setGlobalDraftSource(key, false));

        if (syncedDraftsAreAllowedAndEnabled(state)) {
            try {
                const serverDraft = await Client4.savePageDraft(wikiId, draftId, message, title, pageId, additionalProps);
                const transformedDraft = transformPageServerDraft(serverDraft, wikiId, draftId);

                dispatch(setGlobalItem(key, transformedDraft.value));
                dispatch(setGlobalDraftSource(key, true));
            } catch (error) {
                return {data: false, error};
            }
        }

        return {data: true};
    };
}

export function loadPageDraft(wikiId: string, draftId: string): ActionFuncAsync<PostDraft | null> {
    return async (_dispatch, getState) => {
        const state = getState();
        const key = makePageDraftKey(wikiId, draftId);
        const storedDraft = state.storage.storage[key];

        if (storedDraft && storedDraft.value) {
            return {data: storedDraft.value as PostDraft};
        }

        return {data: null};
    };
}

export function loadPageDraftsForWiki(wikiId: string): ActionFuncAsync<PostDraft[]> {
    return async (dispatch, getState) => {
        const state = getState();

        let serverDrafts: PageDraft[] = [];
        if (syncedDraftsAreAllowedAndEnabled(state)) {
            try {
                const serverDraftsRaw = await Client4.getPageDraftsForWiki(wikiId);
                serverDrafts = serverDraftsRaw.map((draft) => transformPageServerDraft(draft, wikiId, draft.draft_id));
            } catch (error) {
                // Handle error silently
            }
        }

        const prefix = `${StoragePrefixes.PAGE_DRAFT}${wikiId}_`;
        const localDrafts: PageDraft[] = [];

        Object.keys(state.storage.storage).forEach((key) => {
            if (key.startsWith(prefix)) {
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

        const draftsMap = new Map<string, PageDraft>();
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

export function removePageDraft(wikiId: string, draftId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        const state = getState();
        const key = makePageDraftKey(wikiId, draftId);

        // Delete from server first (if sync is enabled)
        if (syncedDraftsAreAllowedAndEnabled(state)) {
            try {
                await Client4.deletePageDraft(wikiId, draftId);
            } catch (error) {
                // Still remove from local storage even if server delete fails
                // This prevents the draft from being stuck in UI
            }
        }

        // Remove from local storage and notify Redux
        const timestamp = Date.now();
        dispatch(batchActions([
            removeGlobalItem(key),
            {type: WikiTypes.DELETED_DRAFT, data: {id: draftId, wikiId}},
            {type: WikiTypes.INVALIDATE_DRAFTS, data: {wikiId, timestamp}},
        ]));

        return {data: true};
    };
}

export function clearPageDraft(wikiId: string, draftId: string): ActionFuncAsync<boolean> {
    return async (dispatch) => {
        return dispatch(removePageDraft(wikiId, draftId));
    };
}

export function syncPageDraftsWithServer(wikiId: string): ActionFuncAsync<boolean> {
    return async (dispatch) => {
        return dispatch(getDrafts(wikiId));
    };
}
