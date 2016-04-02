// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable func-names */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-unreachable */

var assert = require('assert');
import Client from '../client/client.jsx';

function setup() {
    var client = new Client();
    client.setUrl('http://localhost:8065');
    return client;
}

describe('Client.Admin', function() {
    this.timeout(10000);

    var client = setup();

    it('getClientConfig', function(done) {
        client.getClientConfig(
            function(data) {
                assert.equal(data.SiteName, 'Mattermost');
                done();
            },
            function(err) {
                done(new Error(err.message));
            }
        );
    });

    it('getClientLicenceConfig', function(done) {
        setup();

        client.getClientLicenceConfig(
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

