// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ChannelBookmarkPatch} from '@mattermost/types/channel_bookmarks';

import {getChannelBookmarks} from 'mattermost-redux/selectors/entities/channel_bookmarks';

import {
    createBookmarkFromPage,
    deleteBookmark,
    editBookmark,
    reorderBookmark,
} from 'actions/channel_bookmarks';

import type {GlobalState} from 'types/store';

/**
 * Hook to manage page bookmarks.
 * Provides operations for creating, editing, and deleting bookmarks from wiki pages.
 *
 * @param channelId - Channel ID where bookmarks will be created
 * @returns Bookmark state and operations
 */
export function usePageBookmarks(channelId: string) {
    const dispatch = useDispatch();

    const bookmarks = useSelector((state: GlobalState) => getChannelBookmarks(state, channelId));

    const createFromPage = useCallback(async (
        pageId: string,
        displayName?: string,
        emoji?: string,
    ) => {
        return dispatch(createBookmarkFromPage(channelId, pageId, displayName, emoji));
    }, [dispatch, channelId]);

    const remove = useCallback(async (bookmarkId: string) => {
        return dispatch(deleteBookmark(channelId, bookmarkId));
    }, [dispatch, channelId]);

    const edit = useCallback(async (bookmarkId: string, patch: ChannelBookmarkPatch) => {
        return dispatch(editBookmark(channelId, bookmarkId, patch));
    }, [dispatch, channelId]);

    const reorder = useCallback(async (bookmarkId: string, newOrder: number) => {
        return dispatch(reorderBookmark(channelId, bookmarkId, newOrder));
    }, [dispatch, channelId]);

    return {
        bookmarks,
        createFromPage,
        remove,
        edit,
        reorder,
    };
}
