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

describe('Client.Team', function() {
    this.timeout(100000);

    it('findTeamByName', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().findTeamByName(
                TestHelper.basicTeam().name,
                function(data) {
                    assert.equal(data, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('signupTeam', function(done) {
        var client = TestHelper.createClient();
        var email = TestHelper.fakeEmail();

        client.signupTeam(
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
        var client = TestHelper.createClient();
        var email = TestHelper.fakeEmail();

        client.signupTeam(
            email,
            function(data) {
                var teamSignup = {};
                teamSignup.invites = [];
                teamSignup.data = decodeURIComponent(data.follow_link.split('&h=')[0].replace('/signup_team_complete/?d=', ''));
                teamSignup.hash = decodeURIComponent(data.follow_link.split('&h=')[1]);

                teamSignup.user = TestHelper.fakeUser();
                teamSignup.team = TestHelper.fakeTeam();
                teamSignup.team.email = teamSignup.user.email;

                client.createTeamFromSignup(
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

    it('createTeam', function(done) {
        var client = TestHelper.createClient();
        var team = TestHelper.fakeTeam();
        client.createTeam(
            team,
            function(data) {
                assert.equal(data.id.length > 0, true);
                assert.equal(data.name, team.name);
                done();
            },
            function(err) {
                done(new Error(err.message));
            }
        );
    });

    it('getAllTeams', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getAllTeams(
                function(data) {
                    assert.equal(data[TestHelper.basicTeam().id].name, TestHelper.basicTeam().name);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });
});

