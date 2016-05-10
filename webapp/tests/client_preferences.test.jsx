// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';
import TestHelper from './test_helper.jsx';

describe('Client.Preferences', function() {
    this.timeout(100000);

    it('getAllPreferences', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getAllPreferences(
                function(data) {
                    assert.equal(data[0].category, 'tutorial_step');
                    assert.equal(data[0].user_id, TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('savePreferences', function(done) {
        TestHelper.initBasic(() => {
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
                    assert.equal(data, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getPreferenceCategory', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getPreferenceCategory(
                'tutorial_step',
                function(data) {
                    assert.equal(data[0].category, 'tutorial_step');
                    assert.equal(data[0].user_id, TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });
});

