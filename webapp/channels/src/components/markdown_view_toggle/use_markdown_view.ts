// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useSyncExternalStore} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import LocalStorageStore from 'stores/local_storage_store';

import {MarkdownViews} from 'utils/constants';
import type {MarkdownView} from 'utils/constants';

// Every surface that offers the Markdown toggle, and the view it shows until the user picks one
const DEFAULT_VIEWS = {
    file_preview: MarkdownViews.RENDERED,
    code_block: MarkdownViews.RAW,
} as const;

export type MarkdownViewSurface = keyof typeof DEFAULT_VIEWS;

const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

// Other tabs write the same keys, so their choice is picked up too
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    window.addEventListener('storage', listener);

    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', listener);
    };
};

// The view a surface shows for the current user. Every mounted user of a surface follows the same stored value,
// so a choice made on one of them reaches all the others, and a different user simply reads their own.
export function useMarkdownView(surface: MarkdownViewSurface): readonly [MarkdownView, (view: MarkdownView) => void] {
    const userId = useSelector(getCurrentUserId);

    const view = useSyncExternalStore(
        subscribe,
        () => LocalStorageStore.getMarkdownView(surface, userId, DEFAULT_VIEWS[surface]),
    );

    const setView = useCallback((next: MarkdownView) => {
        LocalStorageStore.setMarkdownView(surface, userId, next);
        notify();
    }, [surface, userId]);

    return [view, setView];
}
