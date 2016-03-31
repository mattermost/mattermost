/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable func-names */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-unreachable */

var jsdom = require('mocha-jsdom');
var assert = require('assert');

function setup() {
    global.window.analytics = [];
    global.window.analytics.page = () => {
        // Do Nothing
    };
    global.window.analytics.track = () => {
         // Do Nothing
    };

    var Client = require('../utils/client.jsx');
    Client.setRootUrl('http://localhost:8065');
    return Client;
}

describe('Client.getMeLoggedIn', function() {
    this.timeout(20000);
    jsdom();

    it('basic', function(done) {
        setup();

        var Client = setup();
        Client.getMeLoggedIn(
            function(data) {
                assert.equal(data.logged_in, 'false', 'should have been logged in');
                done();
            },
            function(err) {
                done(new Error(err.message));
            }
        );
    });
});