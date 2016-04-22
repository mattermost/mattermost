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

describe('Client.General', function() {
    this.timeout(10000);

    it('Admin.getClientConfig', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getClientConfig(
                function(data) {
                    assert.equal(data.SiteName, 'Mattermost');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
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

    it('Admin.logClientError', function(done) {
        TestHelper.initBasic(() => {
            var config = {};
            config.site_name = 'test';
            TestHelper.basicClient().logClientError('this is a test');
            done();
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

    it('File.getFileInfo', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            TestHelper.basicClient().getFileInfo(
                `/${TestHelper.basicChannel().id}/${TestHelper.basicUser().id}/filename.txt`,
                function(data) {
                    assert.equal(data.filename, 'filename.txt');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('File.getPublicLink', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            var data = {};
            data.channel_id = TestHelper.basicChannel().id;
            data.user_id = TestHelper.basicUser().id;
            data.filename = `/${TestHelper.basicChannel().id}/${TestHelper.basicUser().id}/filename.txt`;

            TestHelper.basicClient().getPublicLink(
                data,
                function() {
                    done(new Error('not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.file.get_public_link.disabled.app_error');
                    done();
                }
            );
        });
    });
});

