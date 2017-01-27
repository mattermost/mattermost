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

    it('createTeam', function(done) {
        var team = TestHelper.fakeTeam();
        TestHelper.initBasic(() => {
            TestHelper.basicClient().createTeam(
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

    it('getMyTeamMembers', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getMyTeamMembers(
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

    it('getTeamMembers', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getTeamMembers(
                TestHelper.basicTeam().id,
                0,
                100,
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

    it('getTeamMember', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getTeamMember(
                TestHelper.basicTeam().id,
                TestHelper.basicUser().id,
                function(data) {
                    assert.equal(data.user_id, TestHelper.basicUser().id);
                    assert.equal(data.team_id, TestHelper.basicTeam().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getTeamStats', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getTeamStats(
                TestHelper.basicTeam().id,
                function(data) {
                    assert.equal(data.total_member_count > 0, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getTeamMembersByIds', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getTeamMembersByIds(
                TestHelper.basicTeam().id,
                [TestHelper.basicUser().id],
                function(data) {
                    assert.equal(data[0].user_id, TestHelper.basicUser().id);
                    assert.equal(data[0].team_id, TestHelper.basicTeam().id);
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

    it('updateTeamDescription', function(done) {
        TestHelper.initBasic(() => {
            var team = TestHelper.basicTeam();
            team.description = 'test_updated';

            TestHelper.basicClient().updateTeam(
                team,
                function(data) {
                    assert.equal(data.description, 'test_updated');
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

    it('updateTeamMemberRoles', function(done) {
        TestHelper.initBasic(() => {
            var user = TestHelper.basicUser();
            var team = TestHelper.basicTeam();

            TestHelper.basicClient().updateTeamMemberRoles(
                team.id,
                user.id,
                '',
                function() {
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getTeamByName', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getTeamByName(
                TestHelper.basicTeam().name,
                function(data) {
                    console.log(data);
                    assert.equal(data.name, TestHelper.basicTeam().name);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });
});

