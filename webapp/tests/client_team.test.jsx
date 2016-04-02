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

describe('Client.Team', function() {
    this.timeout(100000);

    it('signupTeam', function(done) {
        var email = TestHelper.fakeEmail();

        TestHelper.basicClient().signupTeam(
            email,
            function(data) {
                assert.equal(data.email, email);
                done();
            },
            function(err) {
                done(new Error(err.message));
            }
        );
    });

    it('createTeamFromSignup', function(done) {
        var email = TestHelper.fakeEmail();

        TestHelper.basicClient().signupTeam(
            email,
            function(data) {
                var teamSignup = {};
                teamSignup.invites = [];
                teamSignup.data = decodeURIComponent(data.follow_link.split('&h=')[0].replace('/signup_team_complete/?d=', ''));
                teamSignup.hash = decodeURIComponent(data.follow_link.split('&h=')[1]);

                teamSignup.user = {};
                teamSignup.user.email = email;
                teamSignup.user.allow_marketing = true;
                teamSignup.user.password = 'password1';
                teamSignup.username = TestHelper.generateId();

                teamSignup.team = {};
                teamSignup.team.display_name = 'Javascript Unit Test';
                teamSignup.team.name = TestHelper.generateId();
                teamSignup.team.type = 'O';
                teamSignup.team.email = email;
                teamSignup.team.allowed_domains = '';

                TestHelper.basicClient().createTeamFromSignup(
                    teamSignup,
                    function(data2) {
                        assert.equal(data2.team.id.length > 0, true);
                        assert.equal(data2.user.id.length > 0, true);
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

    it('findTeamByName', function(done) {
        var email = TestHelper.fakeEmail();

        TestHelper.basicClient().findTeamByName(
            email,
            function(data) {
                assert.equal(data, false);
                done();
            },
            function(err) {
                done(new Error(err.message));
            }
        );
    });
});

