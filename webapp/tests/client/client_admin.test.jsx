// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

describe('Client.Admin', function() {
    test('Admin.reloadConfig', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().reloadConfig(
                function() {
                    done.fail(new Error('should need system admin permissions'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.recycleDatabaseConnection', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().recycleDatabaseConnection(
                function() {
                    done.fail(new Error('should need system admin permissions'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.getComplianceReports', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().getComplianceReports(
                function() {
                    done.fail(new Error('should need system admin permissions'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.saveComplianceReports', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            var job = {};
            job.desc = 'desc';
            job.emails = '';
            job.keywords = 'test';
            job.start_at = new Date();
            job.end_at = new Date();

            TestHelper.basicClient().saveComplianceReports(
                job,
                function() {
                    done.fail(new Error('should need system admin permissions'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.getLogs', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().getLogs(
                function() {
                    done.fail(new Error('should need system admin permissions'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.getServerAudits', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().getServerAudits(
                function() {
                    done.fail(new Error('should need system admin permissions'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.getConfig', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().getConfig(
                function() {
                    done.fail(new Error('should need system admin permissions'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.getAnalytics', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().getAnalytics(
                'standard',
                null,
                function() {
                    done.fail(new Error('should need system admin permissions'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.getTeamAnalytics', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().getTeamAnalytics(
                TestHelper.basicTeam().id,
                'standard',
                function() {
                    done.fail(new Error('should need system admin permissions'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.saveConfig', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var config = {};
            config.site_name = 'test';

            TestHelper.basicClient().saveConfig(
                config,
                function() {
                    done.fail(new Error('should need system admin permissions'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.testEmail', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var config = {};
            config.site_name = 'test';

            TestHelper.basicClient().testEmail(
                config,
                function() {
                    done.fail(new Error('should need system admin permissions'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.adminResetMfa', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            TestHelper.basicClient().adminResetMfa(
                TestHelper.basicUser().id,
                function() {
                    done.fail(new Error('should need a license'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.adminResetPassword', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var user = TestHelper.basicUser();

            TestHelper.basicClient().resetPassword(
                user.id,
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

    test('License.getClientLicenceConfig', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getClientLicenceConfig(
                function(data) {
                    expect(data.IsLicensed).toBe('false');
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('License.removeLicenseFile', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().removeLicenseFile(
                function() {
                    done.fail(new Error('not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    test('Admin.ldapSyncNow', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            TestHelper.basicClient().ldapSyncNow(
                function() {
                    throw Error('shouldnt work');
                },
                function() {
                    // this should fail since you're not a system admin
                    done();
                }
            );
        });
    });

    test.skip('License.uploadLicenseFile', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().uploadLicenseFile(
                'form data',
                function() {
                    done.fail(new Error('not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.context.permissions.app_error');
                    done();
                }
            );
        });
    });
});

