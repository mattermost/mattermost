// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';
import TestHelper from './test_helper.jsx';

describe('Client.Hooks', function() {
    this.timeout(100000);

    it('addIncomingHook', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            var hook = {};
            hook.channel_id = TestHelper.basicChannel().id;
            hook.description = 'desc';
            hook.display_name = 'Unit Test';

            TestHelper.basicClient().addIncomingHook(
                hook,
                function() {
                    done(new Error('hooks not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.webhook.create_incoming.disabled.app_errror');
                    done();
                }
            );
        });
    });

    it('deleteIncomingHook', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().deleteIncomingHook(
                TestHelper.generateId(),
                function() {
                    done(new Error('hooks not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.webhook.delete_incoming.disabled.app_errror');
                    done();
                }
            );
        });
    });

    it('listIncomingHooks', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().listIncomingHooks(
                function() {
                    done(new Error('hooks not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.webhook.get_incoming.disabled.app_error');
                    done();
                }
            );
        });
    });

    it('addOutgoingHook', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            var hook = {};
            hook.channel_id = TestHelper.basicChannel().id;
            hook.description = 'desc';
            hook.display_name = 'Unit Test';

            TestHelper.basicClient().addOutgoingHook(
                hook,
                function() {
                    done(new Error('hooks not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.webhook.create_outgoing.disabled.app_error');
                    done();
                }
            );
        });
    });

    it('deleteOutgoingHook', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().deleteOutgoingHook(
                TestHelper.generateId(),
                function() {
                    done(new Error('hooks not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.webhook.delete_outgoing.disabled.app_error');
                    done();
                }
            );
        });
    });

    it('listOutgoingHooks', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().listOutgoingHooks(
                function() {
                    done(new Error('hooks not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.webhook.get_outgoing.disabled.app_error');
                    done();
                }
            );
        });
    });

    it('regenOutgoingHookToken', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
            TestHelper.basicClient().regenOutgoingHookToken(
                TestHelper.generateId(),
                function() {
                    done(new Error('hooks not enabled'));
                },
                function(err) {
                    assert.equal(err.id, 'api.webhook.regen_outgoing_token.disabled.app_error');
                    done();
                }
            );
        });
    });
});

