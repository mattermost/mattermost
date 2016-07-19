// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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

    it('getAllTeamListings', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getAllTeamListings(
                function(data) {
                    assert.equal(data != null, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getMyTeam', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getMyTeam(
                function(data) {
                    assert.equal(data.name, TestHelper.basicTeam().name);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('GetTeamMembers', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getTeamMembers(
                TestHelper.basicTeam().id,
                function(data) {
                    assert.equal(data.length > 0, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('inviteMembers', function(done) {
        TestHelper.initBasic(() => {
            var data = {};
            data.invites = [];
            var invite = {};
            invite.email = TestHelper.fakeEmail();
            invite.firstName = 'first';
            invite.lastName = 'last';
            data.invites.push(invite);

            TestHelper.basicClient().inviteMembers(
                data,
                function(dataBack) {
                    assert.equal(dataBack.invites.length, 1);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('updateTeam', function(done) {
        TestHelper.initBasic(() => {
            var team = TestHelper.basicTeam();
            team.display_name = 'test_updated';

            TestHelper.basicClient().updateTeam(
                team,
                function(data) {
                    assert.equal(data.display_name, 'test_updated');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('addUserToTeam', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().createUser(
                TestHelper.fakeUser(),
                function(user2) {
                    TestHelper.basicClient().addUserToTeam(
                        '',
                        user2.id,
                        function(data) {
                            assert.equal(data.user_id, user2.id);
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

    it('removeUserFromTeam', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().removeUserFromTeam(
                '',
                TestHelper.basicUser().id,
                function(data) {
                    assert.equal(data.user_id, TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getInviteInfo', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getInviteInfo(
                TestHelper.basicTeam().invite_id,
                function(data) {
                    assert.equal(data.display_name.length > 0, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });
});

