// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// Set up a global hooks to make debugging tests less of a pain
beforeAll(() => {
    process.on('unhandledRejection', (reason) => {
        // Rethrow so that tests will actually fail and not just timeout
        throw reason;
    });
});

// Ensure that everything is imported correctly for testing
describe('Sanity test', () => {
    it('Promise', async () => {
        await Promise.resolve(true);
    });

    it('async/await', async () => {
        await Promise.resolve(true);
    });

    it('fetch', async () => {
        try {
            await fetch('http://example.com');
        } catch {
            // No internet connection, but fetch still returned at least
        }
    });
});
