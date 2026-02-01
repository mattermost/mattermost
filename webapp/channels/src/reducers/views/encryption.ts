// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';
import type {EncryptedFileMetadata, OriginalFileInfo} from 'utils/encryption/file';

import type {MMAction} from 'types/store';

export type FileDecryptionStatus = 'pending' | 'decrypting' | 'decrypted' | 'failed';

export interface EncryptedFilesState {
    // Map of fileId → decrypted blob URL
    decryptedUrls: Record<string, string>;

    // Map of fileId → thumbnail blob URL
    thumbnailUrls: Record<string, string>;

    // Decryption status per file
    status: Record<string, FileDecryptionStatus>;

    // Error messages for failed decryptions
    errors: Record<string, string>;

    // Cache of encryption metadata (extracted from post.props - does NOT contain original file info)
    metadata: Record<string, EncryptedFileMetadata>;

    // Original file info (name, type, size) - only available AFTER successful decryption
    originalInfo: Record<string, OriginalFileInfo>;
}

function keyError(state: string | null = null, action: MMAction): string | null {
    switch (action.type) {
    case ActionTypes.ENCRYPTION_KEY_ERROR:
        return action.error;
    case ActionTypes.ENCRYPTION_KEY_ERROR_CLEAR:
    case UserTypes.LOGOUT_SUCCESS:
        return null;
    default:
        return state;
    }
}

function decryptedUrls(state: Record<string, string> = {}, action: MMAction): Record<string, string> {
    switch (action.type) {
    case ActionTypes.ENCRYPTED_FILE_DECRYPTED:
        return {
            ...state,
            [action.fileId]: action.blobUrl,
        };
    case ActionTypes.ENCRYPTED_FILE_CLEANUP: {
        const fileIds = action.fileIds as string[];
        if (!fileIds || fileIds.length === 0) {
            return state;
        }
        const newState = {...state};
        for (const fileId of fileIds) {
            if (newState[fileId]) {
                // Revoke the blob URL to free memory
                URL.revokeObjectURL(newState[fileId]);
                delete newState[fileId];
            }
        }
        return newState;
    }
    case UserTypes.LOGOUT_SUCCESS: {
        // Revoke all blob URLs on logout
        Object.values(state).forEach((url) => {
            URL.revokeObjectURL(url);
        });
        return {};
    }
    default:
        return state;
    }
}

function thumbnailUrls(state: Record<string, string> = {}, action: MMAction): Record<string, string> {
    switch (action.type) {
    case ActionTypes.ENCRYPTED_FILE_THUMBNAIL_GENERATED:
        return {
            ...state,
            [action.fileId]: action.thumbnailUrl,
        };
    case ActionTypes.ENCRYPTED_FILE_CLEANUP: {
        const fileIds = action.fileIds as string[];
        if (!fileIds || fileIds.length === 0) {
            return state;
        }
        const newState = {...state};
        for (const fileId of fileIds) {
            if (newState[fileId]) {
                URL.revokeObjectURL(newState[fileId]);
                delete newState[fileId];
            }
        }
        return newState;
    }
    case UserTypes.LOGOUT_SUCCESS: {
        Object.values(state).forEach((url) => {
            URL.revokeObjectURL(url);
        });
        return {};
    }
    default:
        return state;
    }
}

function status(state: Record<string, FileDecryptionStatus> = {}, action: MMAction): Record<string, FileDecryptionStatus> {
    switch (action.type) {
    case ActionTypes.ENCRYPTED_FILE_METADATA_RECEIVED:
        // Only set pending if not already being processed
        if (!state[action.fileId]) {
            return {
                ...state,
                [action.fileId]: 'pending',
            };
        }
        return state;
    case ActionTypes.ENCRYPTED_FILE_DECRYPTION_STARTED:
        return {
            ...state,
            [action.fileId]: 'decrypting',
        };
    case ActionTypes.ENCRYPTED_FILE_DECRYPTED:
        return {
            ...state,
            [action.fileId]: 'decrypted',
        };
    case ActionTypes.ENCRYPTED_FILE_DECRYPTION_FAILED:
        return {
            ...state,
            [action.fileId]: 'failed',
        };
    case ActionTypes.ENCRYPTED_FILE_CLEANUP: {
        const fileIds = action.fileIds as string[];
        if (!fileIds || fileIds.length === 0) {
            return state;
        }
        const newState = {...state};
        for (const fileId of fileIds) {
            delete newState[fileId];
        }
        return newState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function errors(state: Record<string, string> = {}, action: MMAction): Record<string, string> {
    switch (action.type) {
    case ActionTypes.ENCRYPTED_FILE_DECRYPTION_FAILED:
        return {
            ...state,
            [action.fileId]: action.error,
        };
    case ActionTypes.ENCRYPTED_FILE_DECRYPTION_STARTED:
    case ActionTypes.ENCRYPTED_FILE_DECRYPTED: {
        // Clear error when retrying or successful
        if (state[action.fileId]) {
            const newState = {...state};
            delete newState[action.fileId];
            return newState;
        }
        return state;
    }
    case ActionTypes.ENCRYPTED_FILE_CLEANUP: {
        const fileIds = action.fileIds as string[];
        if (!fileIds || fileIds.length === 0) {
            return state;
        }
        const newState = {...state};
        for (const fileId of fileIds) {
            delete newState[fileId];
        }
        return newState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function metadata(state: Record<string, EncryptedFileMetadata> = {}, action: MMAction): Record<string, EncryptedFileMetadata> {
    switch (action.type) {
    case ActionTypes.ENCRYPTED_FILE_METADATA_RECEIVED:
        return {
            ...state,
            [action.fileId]: action.metadata,
        };
    case ActionTypes.ENCRYPTED_FILE_CLEANUP: {
        const fileIds = action.fileIds as string[];
        if (!fileIds || fileIds.length === 0) {
            return state;
        }
        const newState = {...state};
        for (const fileId of fileIds) {
            delete newState[fileId];
        }
        return newState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

// Original file info - ONLY populated after successful decryption
// This ensures users without decryption keys cannot see file metadata
function originalInfo(state: Record<string, OriginalFileInfo> = {}, action: MMAction): Record<string, OriginalFileInfo> {
    switch (action.type) {
    case ActionTypes.ENCRYPTED_FILE_ORIGINAL_INFO_RECEIVED:
        return {
            ...state,
            [action.fileId]: action.originalInfo,
        };
    case ActionTypes.ENCRYPTED_FILE_CLEANUP: {
        const fileIds = action.fileIds as string[];
        if (!fileIds || fileIds.length === 0) {
            return state;
        }
        const newState = {...state};
        for (const fileId of fileIds) {
            delete newState[fileId];
        }
        return newState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

// Combine the encrypted files reducers into a single encryptedFiles object
const encryptedFiles = combineReducers({
    decryptedUrls,
    thumbnailUrls,
    status,
    errors,
    metadata,
    originalInfo,
});

export default combineReducers({
    keyError,
    encryptedFiles,
});
