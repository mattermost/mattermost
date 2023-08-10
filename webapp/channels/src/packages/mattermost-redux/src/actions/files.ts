// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FileTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

import type {FileSearchResultItem} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';
import type {DispatchFunc, GetStateFunc, ActionFunc} from 'mattermost-redux/types/actions';

export function receivedFiles(files: Map<string, FileSearchResultItem>) {
    return {
        type: FileTypes.RECEIVED_FILES_FOR_SEARCH,
        data: files,
    };
}

export function getMissingFilesByPosts(posts: Post[]) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const {files} = getState().entities.files;
        const postIds = posts.reduce((curr: Array<Post['id']>, post: Post) => {
            const {file_ids: fileIds} = post;
            if (!fileIds || fileIds.every((id) => files[id])) {
                return curr;
            }
            curr.push(post.id);

            return curr;
        }, []);

        const promises: Array<Promise<any>> = [];

        for (const id of postIds) {
            dispatch(getFilesForPost(id));
        }

        return {data: promises};
    };
}

export function getFilesForPost(postId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let files;

        try {
            files = await Client4.getFileInfosForPost(postId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: FileTypes.RECEIVED_FILES_FOR_POST,
            data: files,
            postId,
        });

        return {data: true};
    };
}

export function getFilePublicLink(fileId: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getFilePublicLink,
        onSuccess: FileTypes.RECEIVED_FILE_PUBLIC_LINK,
        params: [
            fileId,
        ],
    });
}
