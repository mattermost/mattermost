// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

describe('Client.Hooks', function() {
    test('addIncomingHook', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            var hook = {};
            hook.channel_id = TestHelper.basicChannel().id;
            hook.description = 'desc';
            hook.display_name = 'Unit Test';

            TestHelper.basicClient().addIncomingHook(
                hook,
                function() {
                    done.fail(new Error('hooks not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.incoming_webhook.disabled.app_error');
                    done();
                }
            );
        });
    });

    test('updateIncomingHook', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            var hook = {};
            hook.channel_id = TestHelper.basicChannel().id;
            hook.description = 'desc';
            hook.display_name = 'Unit Test';

            TestHelper.basicClient().updateIncomingHook(
                hook,
                function() {
                    done.fail(new Error('hooks not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.incoming_webhook.disabled.app_error');
                    done();
                }
            );
        });
    });

    test('deleteIncomingHook', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().deleteIncomingHook(
                TestHelper.generateId(),
                function() {
                    done.fail(new Error('hooks not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.incoming_webhook.disabled.app_error');
                    done();
                }
            );
        });
    });

    test('listIncomingHooks', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().listIncomingHooks(
                function() {
                    done.fail(new Error('hooks not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.incoming_webhook.disabled.app_error');
                    done();
                }
            );
        });
    });

    test('addOutgoingHook', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            var hook = {};
            hook.channel_id = TestHelper.basicChannel().id;
            hook.description = 'desc';
            hook.display_name = 'Unit Test';

            TestHelper.basicClient().addOutgoingHook(
                hook,
                function() {
                    done.fail(new Error('hooks not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.outgoing_webhook.disabled.app_error');
                    done();
                }
            );
        });
    });

    test('deleteOutgoingHook', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().deleteOutgoingHook(
                TestHelper.generateId(),
                function() {
                    done.fail(new Error('hooks not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.outgoing_webhook.disabled.app_error');
                    done();
                }
            );
        });
    });

    test('listOutgoingHooks', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().listOutgoingHooks(
                function() {
                    done.fail(new Error('hooks not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.outgoing_webhook.disabled.app_error');
                    done();
                }
            );
        });
    });

    test('regenOutgoingHookToken', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().regenOutgoingHookToken(
                TestHelper.generateId(),
                function() {
                    done.fail(new Error('hooks not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.outgoing_webhook.disabled.app_error');
                    done();
                }
            );
        });
    });

    test('updateOutgoingHook', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            var hook = {};
            hook.channel_id = TestHelper.basicChannel().id;
            hook.description = 'desc';
            hook.display_name = 'Unit Test';

            TestHelper.basicClient().updateOutgoingHook(
                hook,
                function() {
                    done.fail(new Error('hooks not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.outgoing_webhook.disabled.app_error');
                    done();
                }
            );
        });
    });
});

