// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientConfig} from '@mattermost/types/config';
import type {FileInfo} from '@mattermost/types/files';

import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import {isMobileApp} from 'utils/user_agent';

export const FileSizes = {

    // Bytes
    Byte: 1,
    Kilobyte: 1024,
    Megabyte: 1024 * 1024,
    Gigabyte: 1024 * 1024 * 1024,
    Terabyte: 1024 * 1024 * 1024 * 1024,
} as const;

export function isFileAttachmentsEnabled(config: Partial<ClientConfig>): boolean {
    return config.EnableFileAttachments === 'true';
}

export function canUploadFiles(config: Partial<ClientConfig>): boolean {
    const enableFileAttachments = isFileAttachmentsEnabled(config);
    const enableMobileFileUpload = isMobileFileUploadsEnabled(config);

    if (!enableFileAttachments) {
        return false;
    }

    if (isMobileApp()) {
        return enableMobileFileUpload;
    }

    return true;
}

export function isMobileFileUploadsEnabled(config: Partial<ClientConfig>): boolean {
    return config.EnableMobileFileUpload === 'true';
}

export function canDownloadFiles(config: Partial<ClientConfig>): boolean {
    if (isMobileApp()) {
        return config.EnableMobileFileDownload === 'true';
    }

    return true;
}

export function downloadMultipleFiles(files: FileInfo[]) {
    // Create a hidden container for the download links
    const container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);

    try {
        // Create and click download links for each file
        for (const file of files) {
            const link = document.createElement('a');
            link.href = getFileDownloadUrl(file.id);
            link.download = file.name;
            link.style.display = 'none';
            container.appendChild(link);
            link.click();
        }
    } finally {
        // Clean up the container
        document.body.removeChild(container);
    }
}
