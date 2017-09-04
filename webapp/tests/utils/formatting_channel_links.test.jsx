// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';

import * as TextFormatting from 'utils/text_formatting.jsx';

describe('TextFormatting.ChannelLinks', () => {
    it('Not channel links', (done) => {
        assert.equal(
            TextFormatting.formatText('~123').trim(),
            '<p>~123</p>'
        );

        assert.equal(
            TextFormatting.formatText('~town-square').trim(),
            '<p>~town-square</p>'
        );

        done();
    });

    it('Channel links', (done) => {
        assert.equal(
            TextFormatting.formatText('~town-square', {
                channelNamesMap: {'town-square': {display_name: 'Town Square'}},
                team: {name: 'myteam'}
            }).trim(),
            '<p><a class="mention-link" href="/myteam/channels/town-square" data-channel-mention="town-square">~Town Square</a></p>'
        );
        assert.equal(
            TextFormatting.formatText('~town-square.', {
                channelNamesMap: {'town-square': {display_name: 'Town Square'}},
                team: {name: 'myteam'}
            }).trim(),
            '<p><a class="mention-link" href="/myteam/channels/town-square" data-channel-mention="town-square">~Town Square</a>.</p>'
        );

        assert.equal(
            TextFormatting.formatText('~town-square', {
                channelNamesMap: {'town-square': {display_name: '<b>Reception</b>'}},
                team: {name: 'myteam'}
            }).trim(),
            '<p><a class="mention-link" href="/myteam/channels/town-square" data-channel-mention="town-square">~&lt;b&gt;Reception&lt;/b&gt;</a></p>'
        );

        done();
    });
});
