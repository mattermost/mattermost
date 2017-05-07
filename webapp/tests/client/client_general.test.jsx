// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

describe('Client.General', function() {
    test('General.getClientConfig', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getClientConfig(
                function(data) {
                    expect(data.SiteName).toEqual('Mattermost');
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('General.getPing', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getPing(
                function(data) {
                    expect(data.version.length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('General.logClientError', function(done) {
        TestHelper.initBasic(done, () => {
            var config = {};
            config.site_name = 'test';
            TestHelper.basicClient().logClientError('this is a test');
            done();
        });
    });
});

