// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Zip, ZipPassThrough} from 'fflate';

import type {FileInfo} from '@mattermost/types/files';

import {Client4} from 'mattermost-redux/client';
import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

// The whole archive is held in browser memory until it is saved.
export const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;

export class ArchiveTooLargeError extends Error {}

export class ArchiveFileError extends Error {}

type BuildOptions = {
    signal?: AbortSignal;
    onProgress?: (filesDone: number) => void;
};

// Media is already compressed, so entries are stored rather than deflated.
export async function buildFileArchive(files: FileInfo[], {signal, onProgress}: BuildOptions = {}): Promise<Blob> {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_ARCHIVE_BYTES) {
        throw new ArchiveTooLargeError();
    }

    const chunks: Uint8Array[] = [];
    const zip = new Zip((err, chunk) => {
        if (err) {
            throw err;
        }
        chunks.push(chunk);
    });

    const names = archiveEntryNames(files.map((file) => file.name));
    for (let i = 0; i < files.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        const data = await fetchFileBytes(files[i].id, signal);
        const entry = new ZipPassThrough(names[i]);
        zip.add(entry);
        entry.push(data, true);
        onProgress?.(i + 1);
    }
    zip.end();

    return new Blob(chunks, {type: 'application/zip'});
}

async function fetchFileBytes(fileId: string, signal?: AbortSignal): Promise<Uint8Array> {
    const response = await fetch(getFileDownloadUrl(fileId), {...Client4.getOptions({method: 'get'}), signal});
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ArchiveFileError(typeof body?.message === 'string' ? body.message : '');
    }
    return new Uint8Array(await response.arrayBuffer());
}

// Windows and macOS extract case-insensitively.
export function archiveEntryNames(names: string[]): string[] {
    const used = new Set<string>();
    return names.map((raw) => {
        const name = sanitizeEntryName(raw);
        const dot = name.lastIndexOf('.');
        const stem = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';

        let candidate = name;
        for (let n = 1; used.has(candidate.toLowerCase()); n++) {
            candidate = `${stem} (${n})${ext}`;
        }
        used.add(candidate.toLowerCase());
        return candidate;
    });
}

function sanitizeEntryName(name: string): string {
    const base = name.split(/[\\/]/).pop() ?? '';

    // eslint-disable-next-line no-control-regex
    const cleaned = base.replace(/[\u0000-\u001f:*?"<>|]/g, '_').trim();
    if (!cleaned || cleaned === '.' || cleaned === '..') {
        return 'file';
    }
    return cleaned;
}

export function archiveFilename(channelDisplayName: string | undefined, createAt: number): string {
    const stem = (channelDisplayName ?? '').
        replace(/[^\p{L}\p{N}._]+/gu, '-').
        replace(/^-+|-+$/g, '').
        slice(0, 80) || 'files';

    const date = new Date(createAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${stem}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`;
}
