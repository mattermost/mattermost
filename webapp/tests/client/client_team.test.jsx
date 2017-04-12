// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

describe('Client.Team', function() {
    test('findTeamByName', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().findTeamByName(
                TestHelper.basicTeam().name,
                function(data) {
                    expect(data).toBe(true);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('createTeam', function(done) {
        var team = TestHelper.fakeTeam();
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().createTeam(
                team,
                function(data) {
                    expect(data.id.length).toBeGreaterThan(0);
                    expect(data.name).toEqual(team.name);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getAllTeams', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getAllTeams(
                function(data) {
                    expect(data[TestHelper.basicTeam().id].name).toEqual(TestHelper.basicTeam().name);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getAllTeamListings', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getAllTeamListings(
                function(data) {
                    expect(data).not.toBeNull();
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getMyTeam', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getMyTeam(
                function(data) {
                    expect(data.name).toEqual(TestHelper.basicTeam().name);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getMyTeamMembers', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getMyTeamMembers(
                function(data) {
                    expect(data.length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getTeamMembers', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getTeamMembers(
                TestHelper.basicTeam().id,
                0,
                100,
                function(data) {
                    expect(data.length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getTeamMember', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getTeamMember(
                TestHelper.basicTeam().id,
                TestHelper.basicUser().id,
                function(data) {
                    expect(data.user_id).toEqual(TestHelper.basicUser().id);
                    expect(data.team_id).toEqual(TestHelper.basicTeam().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getTeamStats', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getTeamStats(
                TestHelper.basicTeam().id,
                function(data) {
                    expect(data.total_member_count).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getTeamMembersByIds', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getTeamMembersByIds(
                TestHelper.basicTeam().id,
                [TestHelper.basicUser().id],
                function(data) {
                    expect(data[0].user_id).toEqual(TestHelper.basicUser().id);
                    expect(data[0].team_id).toEqual(TestHelper.basicTeam().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('inviteMembers', function(done) {
        TestHelper.initBasic(done, () => {
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
                    expect(dataBack.invites.length).toBe(1);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('updateTeam', function(done) {
        TestHelper.initBasic(done, () => {
            var team = TestHelper.basicTeam();
            team.display_name = 'test_updated';

            TestHelper.basicClient().updateTeam(
                team,
                function(data) {
                    expect(data.display_name).toBe('test_updated');
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('updateTeamDescription', function(done) {
        TestHelper.initBasic(done, () => {
            var team = TestHelper.basicTeam();
            team.description = 'test_updated';

            TestHelper.basicClient().updateTeam(
                team,
                function(data) {
                    expect(data.description).toBe('test_updated');
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('addUserToTeam', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().createUser(
                TestHelper.fakeUser(),
                function(user2) {
                    TestHelper.basicClient().addUserToTeam(
                        '',
                        user2.id,
                        function(data) {
                            expect(data.user_id).toEqual(user2.id);
                            done();
                        },
                        function(err) {
                            done.fail(new Error(err.message));
                        }
                    );
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('removeUserFromTeam', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().removeUserFromTeam(
                '',
                TestHelper.basicUser().id,
                function(data) {
                    expect(data.user_id).toEqual(TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getInviteInfo', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getInviteInfo(
                TestHelper.basicTeam().invite_id,
                function(data) {
                    expect(data.display_name.length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('updateTeamMemberRoles', function(done) {
        TestHelper.initBasic(done, () => {
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
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getTeamByName', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getTeamByName(
                TestHelper.basicTeam().name,
                function(data) {
                    expect(data.name).toEqual(TestHelper.basicTeam().name);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });
});

