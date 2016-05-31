// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';

import SuggestionBox from 'components/suggestion/suggestion_box.jsx';

describe('SuggestionBox', function() {
    it('findOverlap', function(done) {
        assert.equal(SuggestionBox.findOverlap('', 'blue'), '');
        assert.equal(SuggestionBox.findOverlap('red', ''), '');
        assert.equal(SuggestionBox.findOverlap('red', 'blue'), '');
        assert.equal(SuggestionBox.findOverlap('red', 'dog'), 'd');
        assert.equal(SuggestionBox.findOverlap('red', 'education'), 'ed');
        assert.equal(SuggestionBox.findOverlap('red', 'reduce'), 'red');
        assert.equal(SuggestionBox.findOverlap('black', 'ack'), 'ack');

        done();
    });
});