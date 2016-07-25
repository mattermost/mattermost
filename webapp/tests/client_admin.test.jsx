// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var assert = require('assert');
import TestHelper from './test_helper.jsx';

describe('Client.Admin', function() {
    this.timeout(10000);

    it('Admin.reloadConfig', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().reloadConfig(
                function() {
                    done(new Error('should need system admin permissions'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.system_permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.recycleDatabaseConnection', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().recycleDatabaseConnection(
                function() {
                    done(new Error('should need system admin permissions'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.system_permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.getComplianceReports', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().getComplianceReports(
                function() {
                    done(new Error('should need system admin permissions'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.system_permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.saveComplianceReports', function(done) {
        TestHelper.initBasic(() => {
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
                    done(new Error('should need system admin permissions'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.system_permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.getLogs', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().getLogs(
                function() {
                    done(new Error('should need system admin permissions'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.system_permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.getServerAudits', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().getServerAudits(
                function() {
                    done(new Error('should need system admin permissions'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.system_permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.getConfig', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().getConfig(
                function() {
                    done(new Error('should need system admin permissions'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.system_permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.getAnalytics', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().getAnalytics(
                'standard',
                null,
                function() {
                    done(new Error('should need system admin permissions'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.system_permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.getTeamAnalytics', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().getTeamAnalytics(
                TestHelper.basicTeam().id,
                'standard',
                function() {
                    done(new Error('should need system admin permissions'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.system_permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.saveConfig', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var config = {};
            config.site_name = 'test';

            TestHelper.basicClient().saveConfig(
                config,
                function() {
                    done(new Error('should need system admin permissions'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.system_permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.testEmail', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var config = {};
            config.site_name = 'test';

            TestHelper.basicClient().testEmail(
                config,
                function() {
                    done(new Error('should need system admin permissions'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.system_permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.adminResetMfa', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            TestHelper.basicClient().adminResetMfa(
                TestHelper.basicUser().id,
                function() {
                    done(new Error('should need a license'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.adminResetPassword', function(done) {
        TestHelper.initBasic(() => {
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
                    assert.equal(err.id, 'api.context.invalid_param.app_error');
                    done();
                }
            );
        });
    });

    it('License.getClientLicenceConfig', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getClientLicenceConfig(
                function(data) {
                    assert.equal(data.IsLicensed, 'false');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('License.removeLicenseFile', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().removeLicenseFile(
                function() {
                    done(new Error('not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.permissions.app_error');
                    done();
                }
            );
        });
    });

    it('Admin.ldapSyncNow', function(done) {
        TestHelper.initBasic(() => {
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

    /*it('License.uploadLicenseFile', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().uploadLicenseFile(
                'form data',
                function() {
                    done(new Error('not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.context.permissions.app_error');
                    done();
                }
            );
        });
    });*/

    // TODO XXX FIX ME - this test depends on make dist

    // it('General.getTranslations', function(done) {
    //     TestHelper.initBasic(() => {
    //         TestHelper.basicClient().getTranslations(
    //             'http://localhost:8065/static/i18n/es.json',
    //             function(data) {
    //                 assert.equal(data['login.or'], 'o');
    //                 done();
    //             },
    //             function(err) {
    //                 done(new Error(err.message));
    //             }
    //         );
    //     });
    // });
});

