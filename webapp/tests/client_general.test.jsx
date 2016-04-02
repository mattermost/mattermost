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

    it('General.getTranslations', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getTranslations(
                'http://localhost:8065/static/i18n/es.json',
                function(data) {
                    assert.equal(data['login.or'], 'o');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });
});

