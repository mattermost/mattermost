// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import exif2css from 'exif2css';

import type {ClientConfig} from '@mattermost/types/config';

import Constants from 'utils/constants';
import * as UserAgent from 'utils/user_agent';

export const FileSizes = {
    Bit: 1,
    Byte: 1 * 8,
    Kilobyte: 1 * 8 * 1024,
    Megabyte: 1 * 8 * 1024 * 1024,
    Gigabyte: 1 * 8 * 1024 * 1024 * 1024,
};

export function canUploadFiles(config: Partial<ClientConfig>): boolean {
    const enableFileAttachments = isFileAttachmentsEnabled(config);
    const enableMobileFileUpload = isMobileFileUploadsEnabled(config);

    if (!enableFileAttachments) {
        return false;
    }

    if (UserAgent.isMobileApp()) {
        return enableMobileFileUpload;
    }

    return true;
}

export function isFileAttachmentsEnabled(config: Partial<ClientConfig>): boolean {
    return config.EnableFileAttachments === 'true';
}

export function isMobileFileUploadsEnabled(config: Partial<ClientConfig>): boolean {
    return config.EnableMobileFileUpload === 'true';
}

export function isPublicLinksEnabled(config: Partial<ClientConfig>): boolean {
    return config.EnablePublicLink === 'true';
}

export function canDownloadFiles(config: Partial<ClientConfig>): boolean {
    if (UserAgent.isMobileApp()) {
        return config.EnableMobileFileDownload === 'true';
    }

    return true;
}

export function trimFilename(filename: string) {
    let trimmedFilename = filename;
    if (filename.length > Constants.MAX_FILENAME_LENGTH) {
        trimmedFilename = filename.substring(0, Math.min(Constants.MAX_FILENAME_LENGTH, filename.length)) + '...';
    }

    return trimmedFilename;
}

export function getFileTypeFromMime(mimetype: string) {
    const mimeTypeSplitBySlash = mimetype.split('/');
    const mimeTypePrefix = mimeTypeSplitBySlash[0];
    const mimeTypeSuffix = mimeTypeSplitBySlash[1];

    if (mimeTypePrefix === 'video') {
        return 'video';
    } else if (mimeTypePrefix === 'audio') {
        return 'audio';
    } else if (mimeTypePrefix === 'image') {
        return 'image';
    }

    if (mimeTypeSuffix) {
        if (mimeTypeSuffix === 'pdf') {
            return 'pdf';
        } else if (mimeTypeSuffix.includes('vnd.ms-excel') || mimeTypeSuffix.includes('spreadsheetml') || mimeTypeSuffix.includes('vnd.sun.xml.calc') || mimeTypeSuffix.includes('opendocument.spreadsheet')) {
            return 'spreadsheet';
        } else if (mimeTypeSuffix.includes('vnd.ms-powerpoint') || mimeTypeSuffix.includes('presentationml') || mimeTypeSuffix.includes('vnd.sun.xml.impress') || mimeTypeSuffix.includes('opendocument.presentation')) {
            return 'presentation';
        } else if ((mimeTypeSuffix === 'msword') || mimeTypeSuffix.includes('vnd.ms-word') || mimeTypeSuffix.includes('officedocument.wordprocessingml') || mimeTypeSuffix.includes('application/x-mswrite')) {
            return 'word';
        }
    }

    return 'other';
}

// based on https://stackoverflow.com/questions/7584794/accessing-jpeg-exif-rotation-data-in-javascript-on-the-client-side/32490603#32490603
export function getExifOrientation(data: ArrayBufferLike) {
    const view = new DataView(data);

    if (view.getUint16(0, false) !== 0xFFD8) {
        return -2;
    }

    const length = view.byteLength;
    let offset = 2;

    while (offset < length) {
        const marker = view.getUint16(offset, false);
        offset += 2;

        if (marker === 0xFFE1) {
            if (view.getUint32(offset += 2, false) !== 0x45786966) {
                return -1;
            }

            const little = view.getUint16(offset += 6, false) === 0x4949;
            offset += view.getUint32(offset + 4, little);
            const tags = view.getUint16(offset, little);
            offset += 2;

            for (let i = 0; i < tags; i++) {
                if (view.getUint16(offset + (i * 12), little) === 0x0112) {
                    return view.getUint16(offset + (i * 12) + 8, little);
                }
            }
        } else if ((marker & 0xFF00) === 0xFF00) {
            offset += view.getUint16(offset, false);
        } else {
            break;
        }
    }
    return -1;
}

export function getOrientationStyles(orientation: number) {
    const {
        transform,
        'transform-origin': transformOrigin,
    } = exif2css(orientation);
    return {transform, transformOrigin};
}

/**
 * Gets a file extension from a MIME type.
 * Used for encrypted files where we need to derive extension from the original MIME type.
 */
export function getFileExtensionFromType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'image/bmp': 'bmp',
        'image/tiff': 'tiff',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov',
        'video/x-msvideo': 'avi',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/webm': 'weba',
        'application/pdf': 'pdf',
        'application/zip': 'zip',
        'application/x-zip-compressed': 'zip',
        'application/x-rar-compressed': 'rar',
        'application/x-7z-compressed': '7z',
        'application/x-tar': 'tar',
        'application/gzip': 'gz',
        'application/json': 'json',
        'application/xml': 'xml',
        'text/plain': 'txt',
        'text/html': 'html',
        'text/css': 'css',
        'text/javascript': 'js',
        'text/csv': 'csv',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    };

    const extension = mimeToExt[mimeType];
    if (extension) {
        return extension;
    }

    // Try to extract from mime type suffix (e.g., "application/x-something" -> "something")
    const parts = mimeType.split('/');
    if (parts.length === 2) {
        const suffix = parts[1];
        // Remove common prefixes
        if (suffix.startsWith('x-')) {
            return suffix.substring(2);
        }
        if (suffix.startsWith('vnd.')) {
            return '';
        }
        return suffix;
    }

    return '';
}
