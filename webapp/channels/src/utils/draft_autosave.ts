// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';

import {logError} from 'mattermost-redux/actions/errors';

import {savePageDraft} from 'actions/page_drafts';

import type {DispatchFunc} from 'types/store';

type DebouncedFn = ReturnType<typeof debounce>;

const debouncedSaveMap = new Map<string, DebouncedFn>();

function getDebouncedSave(wikiId: string, pageId: string): DebouncedFn {
    const key = `${wikiId}:${pageId}`;
    if (!debouncedSaveMap.has(key)) {
        debouncedSaveMap.set(
            key,
            debounce(async (dispatch: DispatchFunc, channelId: string, wId: string, pId: string, message: string, title: string) => {
                const result = await dispatch(savePageDraft(channelId, wId, pId, message, title));
                if (result && 'error' in result && result.error) {
                    dispatch(logError(result.error));
                }
            }, 500),
        );
    }
    return debouncedSaveMap.get(key)!;
}

export function debounceSavePageDraft(dispatch: DispatchFunc, channelId: string, wikiId: string, pageId: string, message: string, title: string): void {
    getDebouncedSave(wikiId, pageId)(dispatch, channelId, wikiId, pageId, message, title);
}

export function cancelDebounceSavePageDraft(wikiId: string, pageId: string): void {
    const key = `${wikiId}:${pageId}`;
    const fn = debouncedSaveMap.get(key);
    if (fn) {
        fn.cancel();
        debouncedSaveMap.delete(key);
    }
}

export function flushDebounceSavePageDraft(wikiId: string, pageId: string): void {
    const key = `${wikiId}:${pageId}`;
    debouncedSaveMap.get(key)?.flush();
}
