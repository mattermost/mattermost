// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';
import type {Dispatch} from 'redux';

import type {FileInfo} from '@mattermost/types/files';

import {uploadFile} from 'actions/file_actions';
import type {UploadFile} from 'actions/file_actions';

import Constants from 'utils/constants';
import {generateId} from 'utils/utils';

// Blocked file extensions for security - executable or potentially dangerous file types
const BLOCKED_EXTENSIONS = [
    '.exe', '.dll', '.bat', '.cmd', '.msi', '.com', '.scr', '.pif', // Windows executables
    '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.ps1', '.hta', '.cpl', // Windows scripts
    '.jar', // Java
    '.app', '.dmg', '.pkg', // macOS
    '.deb', '.rpm', '.bin', '.elf', '.sh', // Linux
];

export type FileUploadResult = {
    fileInfo: FileInfo;
    clientId: string;
};

export type FileUploadOptions = {
    file: File;
    channelId: string;
    onProgress?: (percent: number) => void;
    onSuccess?: (result: FileUploadResult) => void;
    onError?: (error: string) => void;
};

/**
 * File validation result
 */
export type FileValidationResult = {
    valid: boolean;
    error?: string;
};

/**
 * Check if a file is a supported media type (image or video)
 */
export function isMediaFile(file: File): boolean {
    return file.type.startsWith('image/') || file.type.startsWith('video/');
}

/**
 * Check if a file is a video
 */
export function isVideoFile(file: File): boolean {
    return file.type.startsWith('video/');
}

/**
 * Get file extension from filename (including the dot)
 */
function getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) {
        return '';
    }
    return filename.substring(lastDot).toLowerCase();
}

/**
 * Check if a file type is blocked (executable or dangerous)
 */
export function isBlockedFileType(file: File): boolean {
    const ext = getFileExtension(file.name);
    return BLOCKED_EXTENSIONS.includes(ext);
}

/**
 * Validate any file for upload
 * Checks file size and blocks dangerous executables
 * Unlike validateMediaFile, this allows all file types except blocked ones
 */
export function validateFile(
    file: File,
    maxFileSize: number,
    intl: IntlShape,
): FileValidationResult {
    // Check for empty or whitespace-only filenames
    if (!file.name || file.name.trim() === '') {
        return {
            valid: false,
            error: intl.formatMessage({
                id: 'file_upload.emptyFilename',
                defaultMessage: 'File name cannot be empty',
            }),
        };
    }

    // Check for zero-byte files
    if (file.size === 0) {
        return {
            valid: false,
            error: intl.formatMessage({
                id: 'file_upload.zeroBytesFile',
                defaultMessage: 'You are uploading an empty file: {filename}',
            }, {filename: file.name}),
        };
    }

    // Check file size
    if (file.size > maxFileSize) {
        const maxSizeMB = maxFileSize / 1048576;
        return {
            valid: false,
            error: intl.formatMessage({
                id: 'file_upload.fileAbove',
                defaultMessage: 'File above {max}MB could not be uploaded: {filename}',
            }, {max: maxSizeMB, filename: file.name}),
        };
    }

    // Check for blocked file types (executables)
    if (isBlockedFileType(file)) {
        return {
            valid: false,
            error: intl.formatMessage({
                id: 'file_upload.blocked_type',
                defaultMessage: 'Executable files cannot be uploaded: {filename}',
            }, {filename: file.name}),
        };
    }

    return {valid: true};
}

/**
 * Validate file for upload (adapted from FileUpload component)
 * Checks file size and type for images and videos
 */
export function validateMediaFile(
    file: File,
    maxFileSize: number,
    intl: IntlShape,
): FileValidationResult {
    // Check for empty or whitespace-only filenames
    if (!file.name || file.name.trim() === '') {
        return {
            valid: false,
            error: intl.formatMessage({
                id: 'file_upload.emptyFilename',
                defaultMessage: 'File name cannot be empty',
            }),
        };
    }

    // Check for zero-byte files
    if (file.size === 0) {
        return {
            valid: false,
            error: intl.formatMessage({
                id: 'file_upload.zeroBytesFile',
                defaultMessage: 'You are uploading an empty file: {filename}',
            }, {filename: file.name}),
        };
    }

    // Check file size
    if (file.size > maxFileSize) {
        const maxSizeMB = maxFileSize / 1048576;
        return {
            valid: false,
            error: intl.formatMessage({
                id: 'file_upload.fileAbove',
                defaultMessage: 'File above {max}MB could not be uploaded: {filename}',
            }, {max: maxSizeMB, filename: file.name}),
        };
    }

    // Check if it's an image or video
    if (!isMediaFile(file)) {
        return {
            valid: false,
            error: intl.formatMessage({
                id: 'file_upload.media_only',
                defaultMessage: 'Only image and video files can be uploaded to the editor',
            }),
        };
    }

    return {valid: true};
}

/**
 * Upload media file (image or video) using Mattermost's existing uploadFile action
 * This is a thin wrapper that adapts MM's uploadFile for TipTap editor use
 *
 * @param options Upload options
 * @param dispatch Redux dispatch function
 * @returns XMLHttpRequest for upload tracking/cancellation
 */
export function uploadMediaForEditor(
    options: FileUploadOptions,
    dispatch: Dispatch,
): XMLHttpRequest {
    const {file, channelId, onProgress, onSuccess, onError} = options;

    // Generate client ID for tracking
    const clientId = generateId();

    // Prepare upload file parameters (matching MM's uploadFile signature)
    const uploadParams: UploadFile = {
        file,
        name: file.name,
        type: file.type,
        rootId: '', // Empty rootId for draft files (PostId = "" in FileInfo)
        channelId,
        clientId,

        // Progress callback
        onProgress: onProgress ? (filePreviewInfo) => {
            if (filePreviewInfo.percent !== undefined) {
                onProgress(filePreviewInfo.percent);
            }
        } : () => {},

        // Success callback
        onSuccess: (response) => {
            if (response.file_infos && response.file_infos.length > 0) {
                const fileInfo = response.file_infos[0];
                onSuccess?.({
                    fileInfo,
                    clientId,
                });
            }
        },

        // Error callback
        onError: (err) => {
            const errorMessage = typeof err === 'string' ? err : err.message;
            onError?.(errorMessage);
        },
    };

    // Use MM's existing uploadFile action
    return dispatch(uploadFile(uploadParams));
}

/**
 * Validate multiple files and return validation results
 * Adapted from FileUpload component's uploadFiles method
 */
export function validateMultipleFiles(
    files: File[],
    maxFileSize: number,
    maxFileCount: number,
    currentFileCount: number,
    intl: IntlShape,
): {
        validFiles: File[];
        errors: string[];
    } {
    const uploadsRemaining = Math.max(0, maxFileCount - currentFileCount);
    const validFiles: File[] = [];
    const tooLargeFiles: File[] = [];
    const zeroFiles: File[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length && validFiles.length < uploadsRemaining; i++) {
        const file = files[i];

        // Check for zero bytes
        if (file.size === 0) {
            zeroFiles.push(file);
            continue;
        }

        // Check file size
        if (file.size > maxFileSize) {
            tooLargeFiles.push(file);
            continue;
        }

        // Check if it's an image or video
        if (!isMediaFile(file)) {
            continue;
        }

        validFiles.push(file);
    }

    // Generate error messages (matching MM's format)
    if (files.length > uploadsRemaining) {
        errors.push(intl.formatMessage({
            id: 'file_upload.limited',
            defaultMessage: 'Uploads limited to {count, number} files maximum. Please use additional posts for more files.',
        }, {count: Constants.MAX_UPLOAD_FILES}));
    }

    if (tooLargeFiles.length > 1) {
        const filenames = tooLargeFiles.map((f) => f.name).join(', ');
        errors.push(intl.formatMessage({
            id: 'file_upload.filesAbove',
            defaultMessage: 'Files above {max}MB could not be uploaded: {filenames}',
        }, {max: maxFileSize / 1048576, filenames}));
    } else if (tooLargeFiles.length === 1) {
        errors.push(intl.formatMessage({
            id: 'file_upload.fileAbove',
            defaultMessage: 'File above {max}MB could not be uploaded: {filename}',
        }, {max: maxFileSize / 1048576, filename: tooLargeFiles[0].name}));
    }

    if (zeroFiles.length > 1) {
        const filenames = zeroFiles.map((f) => f.name).join(', ');
        errors.push(intl.formatMessage({
            id: 'file_upload.zeroBytesFiles',
            defaultMessage: 'You are uploading empty files: {filenames}',
        }, {filenames}));
    } else if (zeroFiles.length === 1) {
        errors.push(intl.formatMessage({
            id: 'file_upload.zeroBytesFile',
            defaultMessage: 'You are uploading an empty file: {filename}',
        }, {filename: zeroFiles[0].name}));
    }

    return {
        validFiles,
        errors,
    };
}
