// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

describe('Client.User', function() {
    test('getMe', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getMe(
                function(data) {
                    expect(data.id).toEqual(TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getUser', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getUser(
                TestHelper.basicUser().id,
                function(data) {
                    expect(data.id).toEqual(TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getByUsername', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getByUsername(
                TestHelper.basicUser().username,
                function(data) {
                    expect(data.username).toEqual(TestHelper.basicUser().username);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getByEmail', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getByEmail(
                TestHelper.basicUser().email,
                function(data) {
                    expect(data.email).toEqual(TestHelper.basicUser().email);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getInitialLoad', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getInitialLoad(
                function(data) {
                    expect(data.user.id.length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('createUser', function(done) {
        var client = TestHelper.createClient();
        var user = TestHelper.fakeUser();
        client.createUser(
            user,
            function(data) {
                expect(data.id.length).toBeGreaterThan(0);
                expect(data.email).toEqual(user.email);
                done();
            },
            function(err) {
                done.fail(new Error(err.message));
            }
        );
    });

    test('loginByEmail', function(done) {
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
                        expect(data.id.length).toBeGreaterThan(0);
                        expect(data.email).toEqual(user.email);
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

    test('loginById', function(done) {
        var client = TestHelper.createClient();
        var user = TestHelper.fakeUser();
        client.createUser(
            user,
            function(newUser) {
                expect(user.email).toEqual(newUser.email);
                client.loginById(
                    newUser.id,
                    user.password,
                    null,
                    function(data) {
                        expect(data.id.length).toBeGreaterThan(0);
                        expect(data.email).toEqual(user.email);
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

    test('loginByUsername', function(done) {
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
                        expect(data.id.length).toBeGreaterThan(0);
                        expect(data.email).toEqual(user.email);
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

    test('updateUser', function(done) {
        TestHelper.initBasic(done, () => {
            var user = TestHelper.basicUser();
            user.nickname = 'updated';

            TestHelper.basicClient().updateUser(
                user, null,
                function(data) {
                    expect(data.nickname).toBe('updated');
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('updatePassword', function(done) {
        TestHelper.initBasic(done, () => {
            var user = TestHelper.basicUser();

            TestHelper.basicClient().updatePassword(
                user.id,
                user.password,
                'update_password',
                function(data) {
                    expect(data.user_id).toEqual(user.id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('updateUserNotifyProps', function(done) {
        TestHelper.initBasic(done, () => {
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
                    expect(data.notify_props.email).toBe('false');
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('updateUserRoles', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var user = TestHelper.basicUser();

            TestHelper.basicClient().updateUserRoles(
                user.id,
                '',
                function() {
                    done.fail(new Error('Not supposed to work'));
                },
                function() {
                    done();
                }
            );
        });
    });

    test('updateActive', function(done) {
        TestHelper.initBasic(done, () => {
            const user = TestHelper.basicUser();

            TestHelper.basicClient().updateActive(
                user.id,
                false,
                function(data) {
                    expect(data.delete_at).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('sendPasswordReset', function(done) {
        TestHelper.initBasic(done, () => {
            var user = TestHelper.basicUser();

            TestHelper.basicClient().sendPasswordReset(
                user.email,
                function(data) {
                    expect(data.email).toEqual(user.email);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('resetPassword', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            TestHelper.basicClient().resetPassword(
                '',
                'new_password',
                function() {
                    throw Error('shouldnt work');
                },
                function(err) {
                    // this should fail since you're not a system admin
                    expect(err.id).toBe('api.context.invalid_param.app_error');
                    done();
                }
            );
        });
    });

    test('emailToOAuth', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var user = TestHelper.basicUser();

            TestHelper.basicClient().emailToOAuth(
                user.email,
                'new_password',
                '',
                'gitlab',
                function() {
                    throw Error('shouldnt work');
                },
                function(err) {
                    // this should fail since you're not a system admin
                    expect(err.id).toBe('api.user.check_user_password.invalid.app_error');
                    done();
                }
            );
        });
    });

    test('oauthToEmail', function(done) {
        TestHelper.initBasic(done, () => {
            var user = TestHelper.basicUser();

            TestHelper.basicClient().oauthToEmail(
                user.email,
                'new_password',
                function(data) {
                    expect(data.follow_link.length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('emailToLdap', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var user = TestHelper.basicUser();

            TestHelper.basicClient().emailToLdap(
                user.email,
                user.password,
                '',
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

    test('ldapToEmail', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var user = TestHelper.basicUser();

            TestHelper.basicClient().ldapToEmail(
                user.email,
                'new_password',
                '',
                'new_password',
                function() {
                    throw Error('shouldnt work');
                },
                function(err) {
                    expect(err.id).toBe('api.user.ldap_to_email.not_ldap_account.app_error');
                    done();
                }
            );
        });
    });

    test('logout', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().logout(
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

    test('checkMfa', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().checkMfa(
                TestHelper.generateId(),
                function(data) {
                    expect(data.mfa_required).toBe('false');
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('generateMfaSecret', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().generateMfaSecret(
                function() {
                    done.fail(new Error('not enabled'));
                },
                function() {
                    done();
                }
            );
        });
    });

    test('getSessions', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getSessions(
                TestHelper.basicUser().id,
                function(data) {
                    expect(data[0].user_id).toEqual(TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('revokeSession', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getSessions(
                TestHelper.basicUser().id,
                function(sessions) {
                    TestHelper.basicClient().revokeSession(
                        sessions[0].id,
                        function(data) {
                            expect(data.id).toEqual(sessions[0].id);
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

    test('getAudits', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getAudits(
                TestHelper.basicUser().id,
                function(data) {
                    expect(data[0].user_id).toEqual(TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getProfiles', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getProfiles(
                0,
                100,
                function(data) {
                    expect(Object.keys(data).length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getProfilesInTeam', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getProfilesInTeam(
                TestHelper.basicTeam().id,
                0,
                100,
                function(data) {
                    expect(data[TestHelper.basicUser().id].id).toEqual(TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getProfilesByIds', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getProfilesByIds(
                [TestHelper.basicUser().id],
                function(data) {
                    expect(data[TestHelper.basicUser().id].id).toEqual(TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getProfilesInChannel', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getProfilesInChannel(
                TestHelper.basicChannel().id,
                0,
                100,
                function(data) {
                    expect(Object.keys(data).length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getProfilesNotInChannel', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getProfilesNotInChannel(
                TestHelper.basicChannel().id,
                0,
                100,
                function(data) {
                    expect(Object.keys(data).length).not.toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('searchUsers', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().searchUsers(
                'uid',
                TestHelper.basicTeam().id,
                {},
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

    test('autocompleteUsersInChannel', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().autocompleteUsersInChannel(
                'uid',
                TestHelper.basicChannel().id,
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

    test('autocompleteUsersInTeam', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().autocompleteUsersInTeam(
                'uid',
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

    test('autocompleteUsers', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().autocompleteUsers(
                'uid',
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

    test('getStatusesByIds', function(done) {
        TestHelper.initBasic(done, () => {
            var ids = [];
            ids.push(TestHelper.basicUser().id);

            TestHelper.basicClient().getStatusesByIds(
                ids,
                function(data) {
                    expect(data[TestHelper.basicUser().id]).not.toBeNull();
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('verifyEmail', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().verifyEmail(
                'junk',
                'junk',
                function() {
                    done.fail(new Error('should be invalid'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.invalid_param.app_error');
                    done();
                }
            );
        });
    });

    test('resendVerification', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().resendVerification(
                TestHelper.basicUser().email,
                function() {
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('updateMfa', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().updateMfa(
                'junk',
                true,
                function() {
                    done.fail(new Error('not enabled'));
                },
                function() {
                    done();
                }
            );
        });
    });
});
