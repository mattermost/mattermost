// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {FileInfo, FileSearchResultItem} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {FileTypes, PostTypes, UserTypes, ChannelBookmarkTypes} from 'mattermost-redux/action_types';

export function files(state: Record<string, FileInfo> = {}, action: MMReduxAction) {
    switch (action.type) {
    case FileTypes.RECEIVED_UPLOAD_FILES:
    case FileTypes.RECEIVED_FILES_FOR_POST: {
        const filesById = action.data.reduce((filesMap: any, file: any) => {
            return {...filesMap,
                [file.id]: file,
            };
        }, {} as any);
        return {...state,
            ...filesById,
        };
    }

    case PostTypes.RECEIVED_NEW_POST:
    case PostTypes.RECEIVED_POST: {
        const post = action.data;

        return storeAllFilesForPost(storeFilesForPost, state, post);
    }

    case PostTypes.RECEIVED_POSTS: {
        const posts: Post[] = Object.values(action.data.posts);

        return posts.reduce((nextState, post) => {
            return storeAllFilesForPost(storeFilesForPost, nextState, post);
        }, state);
    }

    case PostTypes.POST_DELETED:
    case PostTypes.POST_REMOVED: {
        if (action.data && action.data.file_ids && action.data.file_ids.length) {
            const nextState = {...state};
            const fileIds = action.data.file_ids as string[];
            fileIds.forEach((id) => {
                Reflect.deleteProperty(nextState, id);
            });

            return nextState;
        }

        return state;
    }

    case FileTypes.REMOVED_FILE: {
        const nextState = {...state};
        const {fileIds} = action.data;
        if (fileIds) {
            fileIds.forEach((id: string) => {
                Reflect.deleteProperty(nextState, id);
            });
        }

        return nextState;
    }

    case ChannelBookmarkTypes.RECEIVED_BOOKMARKS: {
        const bookmarks: ChannelBookmark[] = action.data.bookmarks;

        const nextState = {...state};

        bookmarks.forEach(({file}) => {
            if (file) {
                nextState[file.id] = file;
            }
        });

        return nextState;
    }

    case ChannelBookmarkTypes.RECEIVED_BOOKMARK: {
        const {file}: ChannelBookmark = action.data;

        if (file) {
            return {...state, [file.id]: file};
        }

        return state;
    }

    case ChannelBookmarkTypes.BOOKMARK_DELETED: {
        const {file}: ChannelBookmark = action.data;

        if (!file) {
            return state;
        }

        const nextState = {...state};
        Reflect.deleteProperty(nextState, file.id);

        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export function filesFromSearch(state: Record<string, FileSearchResultItem> = {}, action: MMReduxAction) {
    switch (action.type) {
    case FileTypes.RECEIVED_FILES_FOR_SEARCH: {
        return {...state,
            ...action.data,
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function storeAllFilesForPost(storeFilesCallback: (state: Record<string, any>, post: Post) => any, state: any, post: Post) {
    let currentState = state;

    // Handle permalink embedded files
    if (post.metadata && post.metadata.embeds) {
        const embeds = post.metadata.embeds;

        currentState = embeds.reduce((nextState, embed) => {
            if (embed && embed.type === 'permalink' && embed.data && 'post' in embed.data && embed.data.post) {
                return storeFilesCallback(nextState, embed.data.post);
            }

            return nextState;
        }, currentState);
    }

    return storeFilesCallback(currentState, post);
}

function storeFilesForPost(state: Record<string, FileInfo>, post: Post) {
    if (!post.metadata || !post.metadata.files) {
        return state;
    }

    return post.metadata.files.reduce((nextState, file) => {
        if (nextState[file.id]) {
            // File is already in the store
            return nextState;
        }

        return {
            ...nextState,
            [file.id]: file,
        };
    }, state);
}

export function fileIdsByPostId(state: Record<string, string[]> = {}, action: MMReduxAction) {
    switch (action.type) {
    case FileTypes.RECEIVED_FILES_FOR_POST: {
        const {data, postId} = action;
        const filesIdsForPost = data.map((file: FileInfo) => file.id);
        return {...state,
            [postId as string]: filesIdsForPost,
        };
    }

    case PostTypes.RECEIVED_NEW_POST:
    case PostTypes.RECEIVED_POST: {
        const post = action.data;

        return storeAllFilesForPost(storeFilesIdsForPost, state, post);
    }

    case PostTypes.RECEIVED_POSTS: {
        const posts: Post[] = Object.values(action.data.posts);

        return posts.reduce((nextState, post) => {
            return storeAllFilesForPost(storeFilesIdsForPost, nextState, post);
        }, state);
    }

    case PostTypes.POST_DELETED:
    case PostTypes.POST_REMOVED: {
        if (action.data) {
            const nextState = {...state};
            Reflect.deleteProperty(nextState, action.data.id);
            return nextState;
        }

        return state;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function storeFilesIdsForPost(state: Record<string, string[]>, post: Post) {
    if (!post.metadata || !post.metadata.files) {
        return state;
    }

    return {
        ...state,
        [post.id]: post.metadata.files ? post.metadata.files.map((file) => file.id) : [],
    };
}

function filePublicLink(state: {link: string} = {link: ''}, action: MMReduxAction) {
    switch (action.type) {
    case FileTypes.RECEIVED_FILE_PUBLIC_LINK: {
        return action.data;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {link: ''};

    default:
        return state;
    }
}

export default combineReducers({
    files,
    filesFromSearch,
    fileIdsByPostId,
    filePublicLink,
});
