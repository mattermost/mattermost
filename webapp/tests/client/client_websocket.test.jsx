// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

describe.skip('Client.WebSocket', function() {
    test('WebSocket.getStatusesByIds', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicWebSocketClient().getStatusesByIds(
                [TestHelper.basicUser().id],
                function(resp) {
                    TestHelper.basicWebSocketClient().close();
                    expect(resp.data[TestHelper.basicUser().id]).toBe('online');
                    done();
                }
            );
        }, true);
    });

    test('WebSocket.getStatuses', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicWebSocketClient().getStatuses(
                function(resp) {
                    TestHelper.basicWebSocketClient().close();
                    expect(resp.data).not.toBe(null);
                    done();
                }
            );
        }, true);
    });

    test('WebSocket.userTyping', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicWebSocketClient().userTyping(
                TestHelper.basicChannel().id,
                '',
                function(resp) {
                    TestHelper.basicWebSocketClient().close();
                    expect(resp.status).toBe('OK');
                    done();
                }
            );
        }, true);
    });
});

