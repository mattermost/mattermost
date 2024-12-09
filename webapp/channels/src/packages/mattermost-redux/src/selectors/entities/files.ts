// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo, FileSearchResultItem} from '@mattermost/types/files';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCurrentUserLocale} from 'mattermost-redux/selectors/entities/i18n';
import {sortFileInfos} from 'mattermost-redux/utils/file_utils';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {Post} from '@mattermost/types/posts';


function getAllFiles(state: GlobalState) {
    return state.entities.files.files;
}

export function getFile(state: GlobalState, id: string) {
    return state.entities.files.files?.[id];
}

function getAllFilesFromSearch(state: GlobalState) {
    return state.entities.files.filesFromSearch;
}

function getFilesIdsForPost(state: GlobalState, postId: string) {
    if (postId) {
        return state.entities.files.fileIdsByPostId[postId] || [];
    }

    return [];
}

export function getFilePublicLink(state: GlobalState) {
    return state.entities.files.filePublicLink;
}

export function makeGetFilesForPost(): (state: GlobalState, postId: string) => FileInfo[] {
    return createSelector(
        'makeGetFilesForPost',
        getAllFiles,
        getFilesIdsForPost,
        getCurrentUserLocale,
        (allFiles, fileIdsForPost, locale) => {
            const fileInfos = fileIdsForPost.map((id) => allFiles[id]).filter((id) => Boolean(id));

            return sortFileInfos(fileInfos, locale);
        },
    );
}

export function getFilesForEditHistory(): (state: GlobalState, editHistoryPost: Post) => FileInfo[] {
    return createSelector(
        'getFilesForEditHistory',
        (state: GlobalState, editHistoryPost: Post) => editHistoryPost,
        getCurrentUserLocale,
        (editHistoryPost, locale) => {
            const fileInfos = editHistoryPost.metadata.files;
            return sortFileInfos(fileInfos, locale);
        },
    );
}

export const getSearchFilesResults: (state: GlobalState) => FileSearchResultItem[] = createSelector(
    'getSearchFilesResults',
    getAllFilesFromSearch,
    (state: GlobalState) => state.entities.search.fileResults,
    (files, fileIds) => {
        if (!fileIds) {
            return [];
        }

        return fileIds.map((id) => files[id]);
    },
);

