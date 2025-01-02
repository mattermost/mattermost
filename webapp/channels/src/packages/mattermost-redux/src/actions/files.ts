import type {FileSearchResultItem} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import {FileTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

import CryptoJS from 'crypto-js/aes';

export function receivedFiles(files: Map<string, FileSearchResultItem>) {
    return {
        type: FileTypes.RECEIVED_FILES_FOR_SEARCH,
        data: files,
    };
}

export function getMissingFilesByPosts(posts: Post[]): ActionFuncAsync {
    return async (dispatch, getState) => {
        const {files} = getState().entities.files;
        const postIds = posts.reduce((curr: Array<Post['id']>, post: Post) => {
            const {file_ids: fileIds} = post;
            if (!fileIds || fileIds.every((id) => files[id])) {
                return curr;
            }
            curr.push(post.id);

            return curr;
        }, []);

        for (const id of postIds) {
            dispatch(getFilesForPost(id));
        }

        return {data: true};
    };
}

export function getFilesForPost(postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        let files;

        try {
            files = await Client4.getFileInfosForPost(postId);
            files = files.map((file) => {
                const decryptedData = decryptAES256(file.data);
                return {...file, data: decryptedData};
            });
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

export function getFilePublicLink(fileId: string) {
    return bindClientFunc({
        clientFunc: Client4.getFilePublicLink,
        onSuccess: FileTypes.RECEIVED_FILE_PUBLIC_LINK,
        params: [
            fileId,
        ],
    });
}

function encryptAES256(data: string): string {
    return CryptoJS.AES.encrypt(data, 'secret key 123').toString();
}

function decryptAES256(data: string): string {
    const bytes = CryptoJS.AES.decrypt(data, 'secret key 123');
    return bytes.toString(CryptoJS.enc.Utf8);
}
