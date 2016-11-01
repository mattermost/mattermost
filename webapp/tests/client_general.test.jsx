// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var assert = require('assert');
import TestHelper from './test_helper.jsx';

describe('Client.General', function() {
    this.timeout(10000);

    it('General.getClientConfig', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getClientConfig(
                function(data) {
                    assert.equal(data.SiteName, 'Mattermost');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('General.getPing', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getPing(
                function(data) {
                    assert.equal(data.version.length > 0, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('General.logClientError', function(done) {
        TestHelper.initBasic(() => {
            var config = {};
            config.site_name = 'test';
            TestHelper.basicClient().logClientError('this is a test');
            done();
        });
    });
});

