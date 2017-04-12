// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

describe('Client.Commands', function() {
    test('listCommands', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().listCommands(
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

    test('listTeamCommands', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().listTeamCommands(
                function() {
                    done.fail(new Error('cmds not enabled'));
                },
                function(err) {
                    expect(err.id).toEqual('api.command.disabled.app_error');
                    done();
                }
            );
        });
    });

    test('executeCommand', function(done) {
        TestHelper.initBasic(done, () => {
            const args = {};
            args.channel_id = TestHelper.basicChannel().id;
            TestHelper.basicClient().executeCommand(
                '/shrug',
                args,
                function(data) {
                    expect(data.response_type).toEqual('in_channel');
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('addCommand', function(done) {
        TestHelper.initBasic(done, () => {
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
                    done.fail(new Error('cmds not enabled'));
                },
                function(err) {
                    expect(err.id).toEqual('api.command.disabled.app_error');
                    done();
                }
            );
        });
    });

    test('editCommand', function(done) {
        TestHelper.initBasic(done, () => {
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

            TestHelper.basicClient().editCommand(
                cmd,
                function() {
                    done.fail(new Error('cmds not enabled'));
                },
                function(err) {
                    expect(err.id).toEqual('api.command.disabled.app_error');
                    done();
                }
            );
        });
    });

    test('deleteCommand', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().deleteCommand(
                TestHelper.generateId(),
                function() {
                    done.fail(new Error('cmds not enabled'));
                },
                function(err) {
                    expect(err.id).toEqual('api.command.disabled.app_error');
                    done();
                }
            );
        });
    });

    test('regenCommandToken', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().regenCommandToken(
                TestHelper.generateId(),
                function() {
                    done.fail(new Error('cmds not enabled'));
                },
                function(err) {
                    expect(err.id).toEqual('api.command.disabled.app_error');
                    done();
                }
            );
        });
    });
});

