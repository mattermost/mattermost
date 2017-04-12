// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

describe('Client.OAuth', function() {
    test('registerOAuthApp', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            var app = {};
            app.name = 'test';
            app.homepage = 'homepage';
            app.description = 'desc';
            app.callback_urls = '';

            TestHelper.basicClient().registerOAuthApp(
                app,
                function() {
                    done.fail(new Error('not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.oauth.register_oauth_app.turn_off.app_error');
                    done();
                }
            );
        });
    });

    test('allowOAuth2', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error

            TestHelper.basicClient().allowOAuth2(
                'GET',
                '123456',
                'http://nowhere.com',
                'state',
                'scope',
                function() {
                    done.fail(new Error('not enabled'));
                },
                function(err) {
                    expect(err.id).toBe('api.oauth.allow_oauth.turn_off.app_error');
                    done();
                }
            );
        });
    });
});
