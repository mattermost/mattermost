import {isIdNotPost, getLatestPostId, getOldestPostId} from 'utils/post_utils';

describe('pending post ID filtering', () => {
    describe('isIdNotPost', () => {
        it('should return false for a valid 26-char post ID', () => {
            expect(isIdNotPost('abcdefghijklmnopqrstuvwxyz')).toBe(false);
        });

        it('should return true for a pending post ID (userId:timestamp)', () => {
            expect(isIdNotPost('dizw1z6o1tdk7mzmhwfswfqkpr:1770763076041')).toBe(true);
        });

        it('should return true for any ID containing a colon', () => {
            expect(isIdNotPost('abc123:456')).toBe(true);
            expect(isIdNotPost('user123456789012345678901:9999999999999')).toBe(true);
        });

        it('should return true for date line IDs', () => {
            expect(isIdNotPost('date-1234567890')).toBe(true);
        });
    });

    describe('getLatestPostId', () => {
        it('should skip pending post IDs and return the latest real post ID', () => {
            const postIds = [
                'dizw1z6o1tdk7mzmhwfswfqkpr:1770763076041', // pending post ID
                'abcdefghijklmnopqrstuvwx01', // real post ID
                'abcdefghijklmnopqrstuvwx02', // older real post ID
            ];
            expect(getLatestPostId(postIds)).toBe('abcdefghijklmnopqrstuvwx01');
        });

        it('should return empty string if only pending post IDs exist', () => {
            const postIds = [
                'user12345678901234567890ab:1770763076041',
                'user12345678901234567890ab:1770763076042',
            ];
            expect(getLatestPostId(postIds)).toBe('');
        });

        it('should return the first post ID when no pending posts exist', () => {
            const postIds = [
                'abcdefghijklmnopqrstuvwx01',
                'abcdefghijklmnopqrstuvwx02',
            ];
            expect(getLatestPostId(postIds)).toBe('abcdefghijklmnopqrstuvwx01');
        });
    });

    describe('getOldestPostId', () => {
        it('should skip pending post IDs and return the oldest real post ID', () => {
            const postIds = [
                'abcdefghijklmnopqrstuvwx01', // real post ID
                'abcdefghijklmnopqrstuvwx02', // older real post ID
                'dizw1z6o1tdk7mzmhwfswfqkpr:1770763076041', // pending post ID
            ];
            expect(getOldestPostId(postIds)).toBe('abcdefghijklmnopqrstuvwx02');
        });

        it('should return empty string if only pending post IDs exist', () => {
            const postIds = [
                'user12345678901234567890ab:1770763076041',
            ];
            expect(getOldestPostId(postIds)).toBe('');
        });
    });
});
