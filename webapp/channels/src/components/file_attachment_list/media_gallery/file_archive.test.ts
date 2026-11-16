// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {strFromU8, strToU8, unzipSync} from 'fflate';

import type {FileInfo} from '@mattermost/types/files';

import {
    ArchiveFileError,
    ArchiveTooLargeError,
    MAX_ARCHIVE_BYTES,
    archiveEntryNames,
    archiveFilename,
    buildFileArchive,
} from './file_archive';

function fileInfo(id: string, name: string, size = 3): FileInfo {
    return {id, name, size} as FileInfo;
}

type FakeFile = {status: number; body: string};

function mockFetch(files: Record<string, FakeFile>) {
    return jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
        const id = String(input).match(/\/files\/([^/?]+)/)?.[1] ?? '';
        const file = files[id] ?? {status: 404, body: JSON.stringify({message: 'Unable to get the file info.'})};
        return {
            ok: file.status >= 200 && file.status < 300,
            status: file.status,
            json: async () => JSON.parse(file.body),
            arrayBuffer: async () => strToU8(file.body).buffer,
        } as Response;
    });
}

// jsdom's Blob has no arrayBuffer().
function readBlob(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });
}

async function unzip(blob: Blob): Promise<Record<string, string>> {
    const entries = unzipSync(new Uint8Array(await readBlob(blob)));
    return Object.fromEntries(Object.entries(entries).map(([name, data]) => [name, strFromU8(data)]));
}

describe('buildFileArchive', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('puts every file in one zip with its original bytes, downloading each through the file endpoint', async () => {
        const fetchSpy = mockFetch({
            a: {status: 200, body: 'red'},
            b: {status: 200, body: 'blue'},
        });
        const onProgress = jest.fn();

        const blob = await buildFileArchive([fileInfo('a', 'photo.png'), fileInfo('b', 'Photo.png')], {onProgress});

        expect(blob.type).toBe('application/zip');
        expect(await unzip(blob)).toEqual({'photo.png': 'red', 'Photo (1).png': 'blue'});
        expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual(['/api/v4/files/a?download=1', '/api/v4/files/b?download=1']);
        expect(onProgress.mock.calls).toEqual([[1], [2]]);
    });

    it('fails with the server message when any file is not accessible', async () => {
        mockFetch({
            a: {status: 200, body: 'red'},
            b: {status: 403, body: JSON.stringify({message: 'You do not have the appropriate permissions.'})},
        });

        const result = buildFileArchive([fileInfo('a', 'a.png'), fileInfo('b', 'b.png')]);

        await expect(result).rejects.toBeInstanceOf(ArchiveFileError);
        await expect(result).rejects.toThrow('You do not have the appropriate permissions.');
    });

    it('refuses sets over the size cap before downloading anything', async () => {
        const fetchSpy = mockFetch({});

        const result = buildFileArchive([fileInfo('a', 'a.mp4', MAX_ARCHIVE_BYTES), fileInfo('b', 'b.mp4', 1)]);

        await expect(result).rejects.toBeInstanceOf(ArchiveTooLargeError);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe('archiveEntryNames', () => {
    it('keeps original names and suffixes case-insensitive collisions', () => {
        expect(archiveEntryNames(['Photo.png', 'photo.png', 'PHOTO.PNG', 'photo (1).png', 'notes'])).toEqual([
            'Photo.png',
            'photo (1).png',
            'PHOTO (2).PNG',
            'photo (1) (1).png',
            'notes',
        ]);
    });

    it('cannot write outside the extraction folder or use reserved characters', () => {
        expect(archiveEntryNames(['../../etc/passwd', 'C:\\temp\\a.png', 'a:b?.png', '..', '', '.bashrc'])).toEqual([
            'passwd',
            'a.png',
            'a_b_.png',
            'file',
            'file (1)',
            '.bashrc',
        ]);
    });
});

describe('archiveFilename', () => {
    const createAt = new Date(2026, 8, 29, 12).getTime();

    it('uses the channel name and post date', () => {
        expect(archiveFilename('Town Square', createAt)).toBe('Town-Square-2026-09-29.zip');
        expect(archiveFilename('日本語 チャンネル', createAt)).toBe('日本語-チャンネル-2026-09-29.zip');
    });

    it('falls back when the channel has no usable name', () => {
        expect(archiveFilename(undefined, createAt)).toBe('files-2026-09-29.zip');
        expect(archiveFilename(' / ', createAt)).toBe('files-2026-09-29.zip');
    });
});
