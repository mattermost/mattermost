// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import {
    isMediaFile,
    isVideoFile,
    validateMediaFile,
    validateMultipleFiles,
} from './file_upload_helper';

const createMockFile = (name: string, type: string, size: number): File => {
    const blob = new Blob(['x'.repeat(size)], {type});
    return new File([blob], name, {type});
};

const mockIntl: IntlShape = {
    formatMessage: ({defaultMessage}: {id: string; defaultMessage: string}, values?: Record<string, unknown>) => {
        let message = defaultMessage;
        if (values) {
            Object.entries(values).forEach(([key, value]) => {
                message = message.replace(`{${key}}`, String(value));
            });
        }
        return message;
    },
} as IntlShape;

describe('file_upload_helper', () => {
    describe('isMediaFile', () => {
        it('returns true for image files', () => {
            expect(isMediaFile(createMockFile('photo.jpg', 'image/jpeg', 1000))).toBe(true);
            expect(isMediaFile(createMockFile('photo.png', 'image/png', 1000))).toBe(true);
            expect(isMediaFile(createMockFile('photo.gif', 'image/gif', 1000))).toBe(true);
            expect(isMediaFile(createMockFile('photo.webp', 'image/webp', 1000))).toBe(true);
            expect(isMediaFile(createMockFile('icon.svg', 'image/svg+xml', 1000))).toBe(true);
        });

        it('returns true for video files', () => {
            expect(isMediaFile(createMockFile('video.mp4', 'video/mp4', 1000))).toBe(true);
            expect(isMediaFile(createMockFile('video.webm', 'video/webm', 1000))).toBe(true);
            expect(isMediaFile(createMockFile('video.mov', 'video/quicktime', 1000))).toBe(true);
            expect(isMediaFile(createMockFile('video.avi', 'video/x-msvideo', 1000))).toBe(true);
        });

        it('returns false for non-media files', () => {
            expect(isMediaFile(createMockFile('doc.pdf', 'application/pdf', 1000))).toBe(false);
            expect(isMediaFile(createMockFile('file.txt', 'text/plain', 1000))).toBe(false);
            expect(isMediaFile(createMockFile('data.json', 'application/json', 1000))).toBe(false);
            expect(isMediaFile(createMockFile('script.js', 'application/javascript', 1000))).toBe(false);
            expect(isMediaFile(createMockFile('audio.mp3', 'audio/mpeg', 1000))).toBe(false);
        });
    });

    describe('isVideoFile', () => {
        it('returns true for video files', () => {
            expect(isVideoFile(createMockFile('video.mp4', 'video/mp4', 1000))).toBe(true);
            expect(isVideoFile(createMockFile('video.webm', 'video/webm', 1000))).toBe(true);
            expect(isVideoFile(createMockFile('video.mov', 'video/quicktime', 1000))).toBe(true);
            expect(isVideoFile(createMockFile('video.avi', 'video/x-msvideo', 1000))).toBe(true);
            expect(isVideoFile(createMockFile('video.mkv', 'video/x-matroska', 1000))).toBe(true);
        });

        it('returns false for image files', () => {
            expect(isVideoFile(createMockFile('photo.jpg', 'image/jpeg', 1000))).toBe(false);
            expect(isVideoFile(createMockFile('photo.png', 'image/png', 1000))).toBe(false);
            expect(isVideoFile(createMockFile('photo.gif', 'image/gif', 1000))).toBe(false);
        });

        it('returns false for non-media files', () => {
            expect(isVideoFile(createMockFile('doc.pdf', 'application/pdf', 1000))).toBe(false);
            expect(isVideoFile(createMockFile('file.txt', 'text/plain', 1000))).toBe(false);
            expect(isVideoFile(createMockFile('audio.mp3', 'audio/mpeg', 1000))).toBe(false);
        });
    });

    describe('validateMediaFile', () => {
        const maxFileSize = 10 * 1024 * 1024; // 10MB

        it('returns valid for image files within size limit', () => {
            const file = createMockFile('photo.jpg', 'image/jpeg', 1000);
            const result = validateMediaFile(file, maxFileSize, mockIntl);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('returns valid for video files within size limit', () => {
            const file = createMockFile('video.mp4', 'video/mp4', 5000);
            const result = validateMediaFile(file, maxFileSize, mockIntl);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('returns error for zero-byte files', () => {
            const file = createMockFile('empty.jpg', 'image/jpeg', 0);
            const result = validateMediaFile(file, maxFileSize, mockIntl);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('empty file');
            expect(result.error).toContain('empty.jpg');
        });

        it('returns error for files exceeding size limit', () => {
            const file = createMockFile('large.mp4', 'video/mp4', 15 * 1024 * 1024);
            const result = validateMediaFile(file, maxFileSize, mockIntl);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('10MB');
            expect(result.error).toContain('large.mp4');
        });

        it('returns error for non-media files', () => {
            const file = createMockFile('document.pdf', 'application/pdf', 1000);
            const result = validateMediaFile(file, maxFileSize, mockIntl);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Only image and video files');
        });

        it('returns error for audio files', () => {
            const file = createMockFile('song.mp3', 'audio/mpeg', 1000);
            const result = validateMediaFile(file, maxFileSize, mockIntl);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Only image and video files');
        });
    });

    describe('validateMultipleFiles', () => {
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        const maxFileCount = 5;

        it('returns all valid files when within limits', () => {
            const files = [
                createMockFile('photo1.jpg', 'image/jpeg', 1000),
                createMockFile('photo2.png', 'image/png', 2000),
                createMockFile('video.mp4', 'video/mp4', 3000),
            ];
            const result = validateMultipleFiles(files, maxFileSize, maxFileCount, 0, mockIntl);
            expect(result.validFiles.length).toBe(3);
            expect(result.errors.length).toBe(0);
        });

        it('filters out non-media files silently', () => {
            const files = [
                createMockFile('photo.jpg', 'image/jpeg', 1000),
                createMockFile('doc.pdf', 'application/pdf', 1000),
                createMockFile('video.mp4', 'video/mp4', 1000),
            ];
            const result = validateMultipleFiles(files, maxFileSize, maxFileCount, 0, mockIntl);
            expect(result.validFiles.length).toBe(2);
            expect(result.errors.length).toBe(0);
        });

        it('returns error for zero-byte files', () => {
            const files = [
                createMockFile('photo.jpg', 'image/jpeg', 1000),
                createMockFile('empty.png', 'image/png', 0),
            ];
            const result = validateMultipleFiles(files, maxFileSize, maxFileCount, 0, mockIntl);
            expect(result.validFiles.length).toBe(1);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('empty.png');
        });

        it('returns error for files exceeding size limit', () => {
            const files = [
                createMockFile('small.jpg', 'image/jpeg', 1000),
                createMockFile('large.mp4', 'video/mp4', 15 * 1024 * 1024),
            ];
            const result = validateMultipleFiles(files, maxFileSize, maxFileCount, 0, mockIntl);
            expect(result.validFiles.length).toBe(1);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('large.mp4');
        });

        it('limits files based on remaining upload count', () => {
            const files = [
                createMockFile('photo1.jpg', 'image/jpeg', 1000),
                createMockFile('photo2.jpg', 'image/jpeg', 1000),
                createMockFile('photo3.jpg', 'image/jpeg', 1000),
            ];
            const result = validateMultipleFiles(files, maxFileSize, maxFileCount, 3, mockIntl); // 3 already uploaded, 2 remaining
            expect(result.validFiles.length).toBe(2);
            expect(result.errors.length).toBe(1); // "Uploads limited" message
        });

        it('handles multiple files exceeding size limit', () => {
            const files = [
                createMockFile('large1.mp4', 'video/mp4', 15 * 1024 * 1024),
                createMockFile('large2.mp4', 'video/mp4', 20 * 1024 * 1024),
            ];
            const result = validateMultipleFiles(files, maxFileSize, maxFileCount, 0, mockIntl);
            expect(result.validFiles.length).toBe(0);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('large1.mp4');
            expect(result.errors[0]).toContain('large2.mp4');
        });

        it('handles multiple zero-byte files', () => {
            const files = [
                createMockFile('empty1.jpg', 'image/jpeg', 0),
                createMockFile('empty2.png', 'image/png', 0),
            ];
            const result = validateMultipleFiles(files, maxFileSize, maxFileCount, 0, mockIntl);
            expect(result.validFiles.length).toBe(0);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('empty1.jpg');
            expect(result.errors[0]).toContain('empty2.png');
        });

        it('returns empty when max files already uploaded', () => {
            const files = [
                createMockFile('photo.jpg', 'image/jpeg', 1000),
            ];
            const result = validateMultipleFiles(files, maxFileSize, maxFileCount, 5, mockIntl); // 5 already uploaded, 0 remaining
            expect(result.validFiles.length).toBe(0);
            expect(result.errors.length).toBe(1);
        });
    });
});
