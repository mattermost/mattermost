// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';
import TestHelper from './test_helper.jsx';

describe('Client.Commands', function() {
    this.timeout(100000);

    it('listCommands', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().listCommands(
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

    it('listTeamCommands', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().listTeamCommands(
                function() {
                    done(new Error('cmds not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.command.disabled.app_error');
                    done();
                }
            );
        });
    });

    it('executeCommand', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().executeCommand(
                TestHelper.basicChannel().id,
                '/shrug',
                null,
                function(data) {
                    assert.equal(data.response_type, 'in_channel');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('addCommand', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            var cmd = {};
            cmd.url = 'http://www.gonowhere.com';
            cmd.trigger = '/hello';
            cmd.method = 'P';
            cmd.username = '';
            cmd.icon_url = '';
            cmd.auto_complete = false;
            cmd.auto_complete_desc = '';
            cmd.auto_complete_hint = '';
            cmd.display_name = 'Unit Test';

            TestHelper.basicClient().addCommand(
                cmd,
                function() {
                    done(new Error('cmds not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.command.disabled.app_error');
                    done();
                }
            );
        });
    });

    it('deleteCommand', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().deleteCommand(
                TestHelper.generateId(),
                function() {
                    done(new Error('cmds not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.command.disabled.app_error');
                    done();
                }
            );
        });
    });

    it('regenCommandToken', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().regenCommandToken(
                TestHelper.generateId(),
                function() {
                    done(new Error('cmds not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.command.disabled.app_error');
                    done();
                }
            );
        });
    });
});

