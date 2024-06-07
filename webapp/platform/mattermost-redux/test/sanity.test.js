// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Set up a global hooks to make debugging tests less of a pain
beforeAll(() => {
    process.on('unhandledRejection', (reason) => {
        // Rethrow so that tests will actually fail and not just timeout
        throw reason;
    });
});

// Ensure that everything is imported correctly for testing
describe('Sanity test', () => {
    it('Promise', (done) => {
        Promise.resolve(true).then(() => {
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('async/await', async () => {
        await Promise.resolve(true);
    });

    it('fetch', (done) => {
        fetch('http://example.com').then(() => {
            done();
        }).catch(() => {
            // No internet connection, but fetch still returned at least
            done();
        });
    });
});
