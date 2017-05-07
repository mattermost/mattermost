// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

describe('Client.Preferences', function() {
    test('getAllPreferences', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getAllPreferences(
                function(data) {
                    expect(data[0].category).toBe('tutorial_step');
                    expect(data[0].user_id).toEqual(TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('savePreferences', function(done) {
        TestHelper.initBasic(done, () => {
            var perf = {};
            perf.user_id = TestHelper.basicUser().id;
            perf.category = 'test';
            perf.name = 'name';
            perf.value = 'value';

            var perfs = [];
            perfs.push(perf);

            TestHelper.basicClient().savePreferences(
                perfs,
                function(data) {
                    expect(data).toBe(true);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getPreferenceCategory', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getPreferenceCategory(
                'tutorial_step',
                function(data) {
                    expect(data[0].category).toBe('tutorial_step');
                    expect(data[0].user_id).toEqual(TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });
});

