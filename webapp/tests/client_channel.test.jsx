// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable func-names */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-unreachable */

import assert from 'assert';
import TestHelper from './test_helper.jsx';

describe('Client.Channels', function() {
    this.timeout(100000);

    // it('createChannel', function(done) {
    //     TestHelper.initBasic(() => {
    //         var channel = TestHelper.fakeChannel();
    //         channel.team_id = TestHelper.basicTeam().id;
    //         TestHelper.basicClient().createChannel(
    //             channel,
    //             function(data) {
    //                 assert.equal(data.id.length > 0, true);
    //                 assert.equal(data.name, channel.name);
    //                 done();
    //             },
    //             function(err) {
    //                 done(new Error(err.message));
    //             }
    //         );
    //     });
    // });
});

