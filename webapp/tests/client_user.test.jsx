// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable func-names */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-unreachable */

var assert = require('assert');
import TestHelper from './test_helper.jsx';

describe('Client.User', function() {
    this.timeout(100000);

    it('getMeLoggedIn', function(done) {
        TestHelper.basicClient().getMeLoggedIn(
            function(data) {
                assert.equal(data.logged_in, 'false');
                done();
            },
            function(err) {
                done(new Error(err.message));
            }
        );
    });
});

