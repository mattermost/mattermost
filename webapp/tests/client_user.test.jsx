// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable func-names */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-unreachable */

import assert from 'assert';
import TestHelper from './test_helper.jsx';

describe('Client.User', function() {
    this.timeout(100000);

    it('getMeLoggedIn', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getMeLoggedIn(
                function(data) {
                    assert.equal(data.logged_in, 'true');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('createUser', function(done) {
        var client = TestHelper.createClient();
        var user = TestHelper.fakeUser();
        client.createUser(
            user,
            function(data) {
                assert.equal(data.id.length > 0, true);
                assert.equal(data.email, user.email);
                done();
            },
            function(err) {
                done(new Error(err.message));
            }
        );
    });

    it('login', function(done) {
        var client = TestHelper.createClient();
        var user = TestHelper.fakeUser();
        client.createUser(
            user,
            function() {
                client.login(
                    user.email,
                    user.password,
                    null,
                    function(data) {
                        assert.equal(data.id.length > 0, true);
                        assert.equal(data.email, user.email);
                        done();
                    },
                    function(err) {
                        done(new Error(err.message));
                    }
                );
            },
            function(err) {
                done(new Error(err.message));
            }
        );
    });
});

