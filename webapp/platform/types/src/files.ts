// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * FileDownloadType represents the type of file download or access being performed.
 */
export type FileDownloadType = 'file' | 'thumbnail' | 'preview' | 'public';

/**
 * FileDownloadTypes contains constants for the different types of file downloads.
 */
export const FileDownloadTypes = {

    /** Full file download request */
    FILE: 'file' as FileDownloadType,

    /** Thumbnail image request */
    THUMBNAIL: 'thumbnail' as FileDownloadType,

    /** Preview image request */
    PREVIEW: 'preview' as FileDownloadType,

    /** Public link access (unauthenticated) */
    PUBLIC: 'public' as FileDownloadType,
} as const;

export type FileInfo = {
    id: string;
    user_id: string;
    channel_id: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    name: string;
    extension: string;
    size: number;
    mime_type: string;
    width: number;
    height: number;
    has_preview_image: boolean;
    clientId: string;
    post_id?: string;
    mini_preview?: string;
    archived: boolean;
    link?: string;
};
export type FilesState = {
    files: Record<string, FileInfo>;
    filesFromSearch: Record<string, FileSearchResultItem>;
    fileIdsByPostId: Record<string, string[]>;
    filePublicLink?: {link: string};
    rejectedFiles: Set<string>;
};

export type FileUploadResponse = {
    file_infos: FileInfo[];
    client_ids: string[];
}

export type FileSearchResultItem = FileInfo & {
    channel_id: string;
}

export type FileSearchResults = {
    order: Array<FileSearchResultItem['id']>;
    file_infos: Map<string, FileSearchResultItem>;
    next_file_info_id: string;
    prev_file_info_id: string;
};
