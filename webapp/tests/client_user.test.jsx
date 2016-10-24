// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';
import TestHelper from './test_helper.jsx';

describe('Client.User', function() {
    this.timeout(100000);

    it('getMe', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getMe(
                function(data) {
                    assert.equal(data.id, TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getUser', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getUser(
                TestHelper.basicUser().id,
                function(data) {
                    assert.equal(data.id, TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getInitialLoad', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getInitialLoad(
                function(data) {
                    assert.equal(data.user.id.length > 0, true);
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

    it('loginByEmail', function(done) {
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

    it('loginById', function(done) {
        var client = TestHelper.createClient();
        var user = TestHelper.fakeUser();
        client.createUser(
            user,
            function(newUser) {
                assert.equal(user.email, newUser.email);
                client.loginById(
                    newUser.id,
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

    it('loginByUsername', function(done) {
        var client = TestHelper.createClient();
        var user = TestHelper.fakeUser();
        client.createUser(
            user,
            function() {
                client.login(
                    user.username,
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

    it('updateUser', function(done) {
        TestHelper.initBasic(() => {
            var user = TestHelper.basicUser();
            user.nickname = 'updated';

            TestHelper.basicClient().updateUser(
                user, null,
                function(data) {
                    assert.equal(data.nickname, 'updated');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('updatePassword', function(done) {
        TestHelper.initBasic(() => {
            var user = TestHelper.basicUser();

            TestHelper.basicClient().updatePassword(
                user.id,
                user.password,
                'update_password',
                function(data) {
                    assert.equal(data.user_id, user.id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('updateUserNotifyProps', function(done) {
        TestHelper.initBasic(() => {
            var user = TestHelper.basicUser();

            var notifyProps = {
                all: 'true',
                channel: 'true',
                desktop: 'all',
                desktop_sound: 'true',
                email: 'false',
                first_name: 'false',
                mention_keys: '',
                comments: 'any',
                user_id: user.id
            };

            TestHelper.basicClient().updateUserNotifyProps(
                notifyProps,
                function(data) {
                    assert.equal(data.notify_props.email, 'false');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('updateUserRoles', function(done) {
        TestHelper.initBasic(() => {
            var user = TestHelper.basicUser();

            TestHelper.basicClient().updateUserRoles(
                user.id,
                '',
                function() {
                    done(new Error('Not supposed to work'));
                },
                function() {
                    done();
                }
            );
        });
    });

    /* TODO: FIX THIS TEST
    it('updateActive', function(done) {
        TestHelper.initBasic(() => {
            var user = TestHelper.basicUser();

            TestHelper.basicClient().updateActive(
                user.id,
                false,
                function(data) {
                    assert.equal(data.last_activity_at > 0, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
        });*/

    it('sendPasswordReset', function(done) {
        TestHelper.initBasic(() => {
            var user = TestHelper.basicUser();

            TestHelper.basicClient().sendPasswordReset(
                user.email,
                function(data) {
                    assert.equal(data.email, user.email);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('resetPassword', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            TestHelper.basicClient().resetPassword(
                '',
                'new_password',
                function() {
                    throw Error('shouldnt work');
                },
                function(err) {
                    // this should fail since you're not a system admin
                    assert.equal(err.id, 'api.context.invalid_param.app_error');
                    done();
                }
            );
        });
    });

    it('emailToOAuth', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var user = TestHelper.basicUser();

            TestHelper.basicClient().emailToOAuth(
                user.email,
                'new_password',
                'gitlab',
                function() {
                    throw Error('shouldnt work');
                },
                function(err) {
                    // this should fail since you're not a system admin
                    assert.equal(err.id, 'api.user.check_user_password.invalid.app_error');
                    done();
                }
            );
        });
    });

    it('oauthToEmail', function(done) {
        TestHelper.initBasic(() => {
            var user = TestHelper.basicUser();

            TestHelper.basicClient().oauthToEmail(
                user.email,
                'new_password',
                function(data) {
                    assert.equal(data.follow_link.length > 0, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('emailToLdap', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var user = TestHelper.basicUser();

            TestHelper.basicClient().emailToLdap(
                user.email,
                user.password,
                'unknown_id',
                'unknown_pwd',
                function() {
                    throw Error('shouldnt work');
                },
                function() {
                    done();
                }
            );
        });
    });

    it('ldapToEmail', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var user = TestHelper.basicUser();

            TestHelper.basicClient().ldapToEmail(
                user.email,
                'new_password',
                'new_password',
                function() {
                    throw Error('shouldnt work');
                },
                function(err) {
                    assert.equal(err.id, 'api.user.ldap_to_email.not_ldap_account.app_error');
                    done();
                }
            );
        });
    });

    it('logout', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().logout(
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

    it('checkMfa', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().checkMfa(
                TestHelper.generateId(),
                function(data) {
                    assert.equal(data.mfa_required, 'false');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getSessions', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getSessions(
                TestHelper.basicUser().id,
                function(data) {
                    assert.equal(data[0].user_id, TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('revokeSession', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getSessions(
                TestHelper.basicUser().id,
                function(sessions) {
                    TestHelper.basicClient().revokeSession(
                        sessions[0].id,
                        function(data) {
                            assert.equal(data.id, sessions[0].id);
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

    it('getAudits', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getAudits(
                TestHelper.basicUser().id,
                function(data) {
                    assert.equal(data[0].user_id, TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getProfiles', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getProfiles(
                0,
                100,
                function(data) {
                    assert.equal(Object.keys(data).length > 0, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getProfilesInTeam', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getProfilesInTeam(
                TestHelper.basicTeam().id,
                0,
                100,
                function(data) {
                    assert.equal(data[TestHelper.basicUser().id].id, TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getProfilesByIds', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getProfilesByIds(
                [TestHelper.basicUser().id],
                function(data) {
                    assert.equal(data[TestHelper.basicUser().id].id, TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getProfilesInChannel', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getProfilesInChannel(
                TestHelper.basicChannel().id,
                0,
                100,
                function(data) {
                    assert.equal(Object.keys(data).length > 0, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getProfilesNotInChannel', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getProfilesNotInChannel(
                TestHelper.basicChannel().id,
                0,
                100,
                function(data) {
                    assert.equal(Object.keys(data).length > 0, false);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('searchUsers', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().searchUsers(
                'uid',
                TestHelper.basicTeam().id,
                {},
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

    it('autocompleteUsersInChannel', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().autocompleteUsersInChannel(
                'uid',
                TestHelper.basicChannel().id,
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

    it('autocompleteUsersInTeam', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().autocompleteUsersInTeam(
                'uid',
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

    it('getStatusesByIds', function(done) {
        TestHelper.initBasic(() => {
            var ids = [];
            ids.push(TestHelper.basicUser().id);

            TestHelper.basicClient().getStatusesByIds(
                ids,
                function(data) {
                    assert.equal(data[TestHelper.basicUser().id] != null, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('setActiveChannel', function(done) {
        TestHelper.initBasic(() => {
            var ids = [];
            ids.push(TestHelper.basicUser().id);

            TestHelper.basicClient().setActiveChannel(
                TestHelper.basicChannel().id,
                function() {
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('verifyEmail', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().verifyEmail(
                'junk',
                'junk',
                function() {
                    done(new Error('should be invalid'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.invalid_param.app_error');
                    done();
                }
            );
        });
    });

    it('resendVerification', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().resendVerification(
                TestHelper.basicUser().email,
                function() {
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('updateMfa', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().updateMfa(
                'junk',
                true,
                function() {
                    done(new Error('not enabled'));
                },
                function() {
                    done();
                }
            );
        });
    });
});
