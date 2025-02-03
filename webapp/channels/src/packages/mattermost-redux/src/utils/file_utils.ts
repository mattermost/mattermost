// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';

import {Client4} from 'mattermost-redux/client';

import {Files, General} from '../constants';

export function getFormattedFileSize(file: FileInfo): string {
    const bytes = file.size;
    const fileSizes = [
        ['TB', 1024 * 1024 * 1024 * 1024],
        ['GB', 1024 * 1024 * 1024],
        ['MB', 1024 * 1024],
        ['KB', 1024],
    ] as const;
    const size = fileSizes.find((unitAndMinBytes) => {
        const minBytes = unitAndMinBytes[1];
        return bytes > minBytes;
    });

    if (size) {
        return `${Math.floor(bytes / (size[1] as any))} ${size[0]}`;
    }

    return `${bytes} B`;
}

export function getFileType(file: FileInfo): string {
    if (!file || !file.extension) {
        return 'other';
    }

    const fileExt = file.extension.toLowerCase();
    const fileTypes = [
        'image',
        'code',
        'pdf',
        'video',
        'audio',
        'spreadsheet',
        'text',
        'word',
        'presentation',
        'patch',
    ];
    return fileTypes.find((fileType) => {
        const constForFileTypeExtList = `${fileType}_types`.toUpperCase();
        const fileTypeExts = Files[constForFileTypeExtList];
        return fileTypeExts.indexOf(fileExt) > -1;
    }) || 'other';
}

export function getFileUrl(fileId: string): string {
    return Client4.getFileRoute(fileId);
}

export function getFileDownloadUrl(fileId: string): string {
    return `${Client4.getFileRoute(fileId)}?download=1`;
}

export function getFileThumbnailUrl(fileId: string): string {
    return `${Client4.getFileRoute(fileId)}/thumbnail`;
}

export function getFilePreviewUrl(fileId: string): string {
    return `${Client4.getFileRoute(fileId)}/preview`;
}

export function getFileMiniPreviewUrl(fileInfo?: FileInfo): string | undefined {
    if (!fileInfo?.mini_preview || !fileInfo?.mime_type) {
        return undefined;
    }
    return `data:${fileInfo.mime_type};base64,${fileInfo.mini_preview}`;
}

export function sortFileInfos(fileInfos: FileInfo[] = [], locale: string = General.DEFAULT_LOCALE): FileInfo[] {
    return fileInfos.sort((a, b) => {
        if (a.create_at !== b.create_at) {
            return a.create_at - b.create_at;
        }

        return a.name.localeCompare(b.name, locale, {numeric: true});
    });
}
