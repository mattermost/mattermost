// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, it, expect, vi, beforeEach} from 'vitest';

import {
    trimFilename,
    canUploadFiles,
    getFileTypeFromMime,
} from 'utils/file_utils';
import * as UserAgent from 'utils/user_agent';

vi.mock('utils/user_agent', () => ({
    isMobileApp: vi.fn(() => false),
}));

describe('FileUtils.trimFilename', () => {
    it('trimFilename: should return same filename', () => {
        expect(trimFilename('abcdefghijklmnopqrstuvwxyz')).toBe('abcdefghijklmnopqrstuvwxyz');
    });

    it('trimFilename: should return trimmed filename', () => {
        expect(trimFilename('abcdefghijklmnopqrstuvwxyz0123456789')).toBe('abcdefghijklmnopqrstuvwxyz012345678...');
    });
});

describe('FileUtils.canUploadFiles', () => {
    beforeEach(() => {
        vi.mocked(UserAgent.isMobileApp).mockReturnValue(false);
    });

    it('is false when file attachments are disabled', () => {
        const config = {
            EnableFileAttachments: 'false',
            EnableMobileFileUpload: 'true',
        };
        expect(canUploadFiles(config)).toBe(false);
    });

    describe('is true when file attachments are enabled', () => {
        it('and not on mobile', () => {
            vi.mocked(UserAgent.isMobileApp).mockReturnValue(false);

            const config = {
                EnableFileAttachments: 'true',
                EnableMobileFileUpload: 'false',
            };
            expect(canUploadFiles(config)).toBe(true);
        });

        it('and on mobile with mobile file upload enabled', () => {
            vi.mocked(UserAgent.isMobileApp).mockReturnValue(true);

            const config = {
                EnableFileAttachments: 'true',
                EnableMobileFileUpload: 'true',
            };
            expect(canUploadFiles(config)).toBe(true);
        });

        it('unless on mobile with mobile file upload disabled', () => {
            vi.mocked(UserAgent.isMobileApp).mockReturnValue(true);

            const config = {
                EnableFileAttachments: 'true',
                EnableMobileFileUpload: 'false',
            };
            expect(canUploadFiles(config)).toBe(false);
        });
    });

    describe('get filetypes based on mime interpreted from browsers', () => {
        it('mime type for videos', () => {
            expect(getFileTypeFromMime('video/mp4')).toBe('video');
        });

        it('mime type for audio', () => {
            expect(getFileTypeFromMime('audio/mp3')).toBe('audio');
        });

        it('mime type for image', () => {
            expect(getFileTypeFromMime('image/JPEG')).toBe('image');
        });

        it('mime type for pdf', () => {
            expect(getFileTypeFromMime('application/pdf')).toBe('pdf');
        });

        it('mime type for spreadsheet', () => {
            expect(getFileTypeFromMime('application/vnd.ms-excel')).toBe('spreadsheet');
        });

        it('mime type for presentation', () => {
            expect(getFileTypeFromMime('application/vnd.ms-powerpoint')).toBe('presentation');
        });

        it('mime type for word', () => {
            expect(getFileTypeFromMime('application/vnd.ms-word')).toBe('word');
        });

        it('mime type for unknown file format', () => {
            expect(getFileTypeFromMime('application/unknownFormat')).toBe('other');
        });

        it('mime type for no suffix', () => {
            expect(getFileTypeFromMime('asdasd')).toBe('other');
        });
    });
});
