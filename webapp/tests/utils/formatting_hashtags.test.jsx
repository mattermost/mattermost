// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';

import * as TextFormatting from 'utils/text_formatting.jsx';

describe('TextFormatting.Hashtags', function() {
    it('Not hashtags', function(done) {
        assert.equal(
            TextFormatting.formatText('# hashtag').trim(),
            '<h1 class="markdown__heading">hashtag</h1>'
        );

        assert.equal(
            TextFormatting.formatText('#ab').trim(),
            '<p>#ab</p>'
        );

        assert.equal(
            TextFormatting.formatText('#123test').trim(),
            '<p>#123test</p>'
        );

        done();
    });

    it('Hashtags', function(done) {
        assert.equal(
            TextFormatting.formatText('#test').trim(),
            "<p><a class='mention-link' href='#' data-hashtag='#test'>#test</a></p>"
        );

        assert.equal(
            TextFormatting.formatText('#test123').trim(),
            "<p><a class='mention-link' href='#' data-hashtag='#test123'>#test123</a></p>"
        );

        assert.equal(
            TextFormatting.formatText('#test-test').trim(),
            "<p><a class='mention-link' href='#' data-hashtag='#test-test'>#test-test</a></p>"
        );

        assert.equal(
            TextFormatting.formatText('#test_test').trim(),
            "<p><a class='mention-link' href='#' data-hashtag='#test_test'>#test_test</a></p>"
        );

        assert.equal(
            TextFormatting.formatText('#test.test').trim(),
            "<p><a class='mention-link' href='#' data-hashtag='#test.test'>#test.test</a></p>"
        );

        assert.equal(
            TextFormatting.formatText('#test1/#test2').trim(),
            "<p><a class='mention-link' href='#' data-hashtag='#test1'>#test1</a>/<wbr /><a class='mention-link' href='#' data-hashtag='#test2'>#test2</a></p>"
        );

        assert.equal(
            TextFormatting.formatText('(#test)').trim(),
            "<p>(<a class='mention-link' href='#' data-hashtag='#test'>#test</a>)</p>"
        );

        assert.equal(
            TextFormatting.formatText('#test-').trim(),
            "<p><a class='mention-link' href='#' data-hashtag='#test'>#test</a>-</p>"
        );

        assert.equal(
            TextFormatting.formatText('#test.').trim(),
            "<p><a class='mention-link' href='#' data-hashtag='#test'>#test</a>.</p>"
        );

        assert.equal(
            TextFormatting.formatText('This is a sentence #test containing a hashtag').trim(),
            "<p>This is a sentence <a class='mention-link' href='#' data-hashtag='#test'>#test</a> containing a hashtag</p>"
        );

        done();
    });

    it('Formatted hashtags', function(done) {
        assert.equal(
            TextFormatting.formatText('*#test*').trim(),
            "<p><em><a class='mention-link' href='#' data-hashtag='#test'>#test</a></em></p>"
        );

        assert.equal(
            TextFormatting.formatText('_#test_').trim(),
            "<p><em><a class='mention-link' href='#' data-hashtag='#test'>#test</a></em></p>"
        );

        assert.equal(
            TextFormatting.formatText('**#test**').trim(),
            "<p><strong><a class='mention-link' href='#' data-hashtag='#test'>#test</a></strong></p>"
        );

        assert.equal(
            TextFormatting.formatText('__#test__').trim(),
            "<p><strong><a class='mention-link' href='#' data-hashtag='#test'>#test</a></strong></p>"
        );

        assert.equal(
            TextFormatting.formatText('~~#test~~').trim(),
            "<p><del><a class='mention-link' href='#' data-hashtag='#test'>#test</a></del></p>"
        );

        assert.equal(
            TextFormatting.formatText('`#test`').trim(),
            '<p>' +
                '<span class="codespan__pre-wrap">' +
                    '<code>' +
                        '#test' +
                    '</code>' +
                '</span>' +
            '</p>'
        );

        assert.equal(
            TextFormatting.formatText('[this is a link #test](example.com)').trim(),
            '<p><a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">this is a link #test</a></p>'
        );

        done();
    });

    it('Searching for hashtags', function(done) {
        assert.equal(
            TextFormatting.formatText('#test', {searchTerm: 'test'}).trim(),
            "<p><span class='search-highlight'><a class='mention-link' href='#' data-hashtag='#test'>#test</a></span></p>"
        );

        assert.equal(
            TextFormatting.formatText('#test', {searchTerm: '#test'}).trim(),
            "<p><span class='search-highlight'><a class='mention-link' href='#' data-hashtag='#test'>#test</a></span></p>"
        );

        assert.equal(
            TextFormatting.formatText('#foo/#bar', {searchTerm: '#foo'}).trim(),
            "<p><span class='search-highlight'><a class='mention-link' href='#' data-hashtag='#foo'>#foo</a></span>/<wbr /><a class='mention-link' href='#' data-hashtag='#bar'>#bar</a></p>"
        );

        assert.equal(
            TextFormatting.formatText('#foo/#bar', {searchTerm: 'bar'}).trim(),
            "<p><a class='mention-link' href='#' data-hashtag='#foo'>#foo</a>/<wbr /><span class='search-highlight'><a class='mention-link' href='#' data-hashtag='#bar'>#bar</a></span></p>"
        );

        assert.equal(
            TextFormatting.formatText('not#test', {searchTerm: '#test'}).trim(),
            '<p>not#test</p>'
        );

        done();
    });

    it('Potential hashtags with other entities nested', function(done) {
        assert.equal(
            TextFormatting.formatText('#@test').trim(),
            '<p>#@test</p>'
        );

        let options = {
            usernameMap: {
                test: {id: '1234', username: 'test'}
            }
        };
        assert.equal(
            TextFormatting.formatText('#@test', options).trim(),
            "<p>#<span data-mention='test'><a class='mention-link' href='#'>@test</a></span></p>"
        );

        assert.equal(
            TextFormatting.formatText('#~test').trim(),
            '<p>#~test</p>'
        );

        options = {
            channelNamesMap: {
                test: {id: '1234', name: 'test', display_name: 'Test Channel'}
            },
            team: {id: 'abcd', name: 'abcd', display_name: 'Alphabet'}
        };
        assert.equal(
            TextFormatting.formatText('#~test', options).trim(),
            '<p>#~test</p>'
        );

        assert.equal(
            TextFormatting.formatText('#:taco:').trim(),
            '<p>#<span alt=":taco:" class="emoticon" title=":taco:" style="background-image:url(/static/emoji/taco.png)"></span></p>'
        );

        assert.equal(
            TextFormatting.formatText('#test@example.com').trim(),
            "<p><a class='mention-link' href='#' data-hashtag='#test'>#test</a>@example.com</p>"
        );

        done();
    });
});
