// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EmojiMap from 'utils/emoji_map';
import * as TextFormatting from 'utils/text_formatting';

const emojiMap = new EmojiMap(new Map());

describe('TextFormatting.Hashtags with default setting', () => {
    it('Not hashtags', () => {
        expect(TextFormatting.formatText('# hashtag', {}, emojiMap).trim()).toBe(
            '<h1 class="markdown__heading">hashtag</h1>',
        );

        expect(TextFormatting.formatText('#ab', {}, emojiMap).trim()).toBe(
            '<p>#ab</p>',
        );

        expect(TextFormatting.formatText('#123test', {}, emojiMap).trim()).toBe(
            '<p>#123test</p>',
        );
    });

    it('Hashtags', () => {
        expect(TextFormatting.formatText('#test', {}, emojiMap).trim()).toBe(
            "<p><a class='mention-link' href='#' data-hashtag='#test'>#test</a></p>",
        );

        expect(TextFormatting.formatText('#test123', {}, emojiMap).trim()).toBe(
            "<p><a class='mention-link' href='#' data-hashtag='#test123'>#test123</a></p>",
        );

        expect(TextFormatting.formatText('#test-test', {}, emojiMap).trim()).toBe(
            "<p><a class='mention-link' href='#' data-hashtag='#test-test'>#test-test</a></p>",
        );

        expect(TextFormatting.formatText('#test_test', {}, emojiMap).trim()).toBe(
            "<p><a class='mention-link' href='#' data-hashtag='#test_test'>#test_test</a></p>",
        );

        expect(TextFormatting.formatText('#test.test', {}, emojiMap).trim()).toBe(
            "<p><a class='mention-link' href='#' data-hashtag='#test.test'>#test.test</a></p>",
        );

        expect(TextFormatting.formatText('#test1/#test2', {}, emojiMap).trim()).toBe(
            "<p><a class='mention-link' href='#' data-hashtag='#test1'>#test1</a>/<a class='mention-link' href='#' data-hashtag='#test2'>#test2</a></p>",
        );

        expect(TextFormatting.formatText('(#test)', {}, emojiMap).trim()).toBe(
            "<p>(<a class='mention-link' href='#' data-hashtag='#test'>#test</a>)</p>",
        );

        expect(TextFormatting.formatText('#test-', {}, emojiMap).trim()).toBe(
            "<p><a class='mention-link' href='#' data-hashtag='#test'>#test</a>-</p>",
        );

        expect(TextFormatting.formatText('#test.', {}, emojiMap).trim()).toBe(
            "<p><a class='mention-link' href='#' data-hashtag='#test'>#test</a>.</p>",
        );

        expect(TextFormatting.formatText('This is a sentence #test containing a hashtag', {}, emojiMap).trim()).toBe(
            "<p>This is a sentence <a class='mention-link' href='#' data-hashtag='#test'>#test</a> containing a hashtag</p>",
        );
    });

    it('Formatted hashtags', () => {
        expect(TextFormatting.formatText('*#test*', {}, emojiMap).trim()).toBe(
            "<p><em><a class='mention-link' href='#' data-hashtag='#test'>#test</a></em></p>",
        );

        expect(TextFormatting.formatText('_#test_', {}, emojiMap).trim()).toBe(
            "<p><em><a class='mention-link' href='#' data-hashtag='#test'>#test</a></em></p>",
        );

        expect(TextFormatting.formatText('**#test**', {}, emojiMap).trim()).toBe(
            "<p><strong><a class='mention-link' href='#' data-hashtag='#test'>#test</a></strong></p>",
        );

        expect(TextFormatting.formatText('__#test__', {}, emojiMap).trim()).toBe(
            "<p><strong><a class='mention-link' href='#' data-hashtag='#test'>#test</a></strong></p>",
        );

        expect(TextFormatting.formatText('~~#test~~', {}, emojiMap).trim()).toBe(
            "<p><del><a class='mention-link' href='#' data-hashtag='#test'>#test</a></del></p>",
        );

        expect(TextFormatting.formatText('`#test`', {}, emojiMap).trim()).toBe(
            '<p>' +
                '<span class="codespan__pre-wrap">' +
                    '<code>' +
                        '#test' +
                    '</code>' +
                '</span>' +
            '</p>',
        );

        expect(TextFormatting.formatText('[this is a link #test](example.com)', {}, emojiMap).trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">this is a link #test</a></p>',
        );
    });

    it('Searching for hashtags', () => {
        expect(TextFormatting.formatText('#test', {searchTerm: 'test'}, emojiMap).trim()).toBe(
            '<p><span class="search-highlight"><a class=\'mention-link\' href=\'#\' data-hashtag=\'#test\'>#test</a></span></p>',
        );

        expect(TextFormatting.formatText('#test', {searchTerm: '#test'}, emojiMap).trim()).toBe(
            '<p><span class="search-highlight"><a class=\'mention-link\' href=\'#\' data-hashtag=\'#test\'>#test</a></span></p>',
        );

        expect(TextFormatting.formatText('#foo/#bar', {searchTerm: '#foo'}, emojiMap).trim()).toBe(
            '<p><span class="search-highlight"><a class=\'mention-link\' href=\'#\' data-hashtag=\'#foo\'>#foo</a></span>/<a class=\'mention-link\' href=\'#\' data-hashtag=\'#bar\'>#bar</a></p>',
        );

        expect(TextFormatting.formatText('#foo/#bar', {searchTerm: 'bar'}, emojiMap).trim()).toBe(
            '<p><a class=\'mention-link\' href=\'#\' data-hashtag=\'#foo\'>#foo</a>/<span class="search-highlight"><a class=\'mention-link\' href=\'#\' data-hashtag=\'#bar\'>#bar</a></span></p>',
        );

        expect(TextFormatting.formatText('not#test', {searchTerm: '#test'}, emojiMap).trim()).toBe(
            '<p>not#test</p>',
        );
    });

    it('Potential hashtags with other entities nested', () => {
        expect(TextFormatting.formatText('#@test', {}, emojiMap).trim()).toBe(
            '<p>#@test</p>',
        );

        let options: TextFormatting.TextFormattingOptions = {
            atMentions: true,
        };
        expect(TextFormatting.formatText('#@test', options, emojiMap).trim()).toBe(
            '<p>#<span data-mention="test">@test</span></p>',
        );

        expect(TextFormatting.formatText('#~test', {}, emojiMap).trim()).toBe(
            '<p>#~test</p>',
        );

        options = {
            channelNamesMap: {
                test: {display_name: 'Test Channel'},
            },
            team: {id: 'abcd', name: 'abcd', display_name: 'Alphabet'},
        };
        expect(TextFormatting.formatText('#~test', options, emojiMap).trim()).toBe(
            '<p>#<a class="mention-link" href="/abcd/channels/test" data-channel-mention="test">~Test Channel</a></p>',
        );

        expect(TextFormatting.formatText('#:mattermost:', {}, emojiMap).trim()).toBe(
            '<p>#<span data-emoticon="mattermost">:mattermost:</span></p>',
        );

        expect(TextFormatting.formatText('#test@example.com', {}, emojiMap).trim()).toBe(
            "<p><a class='mention-link' href='#' data-hashtag='#test@example.com'>#test@example.com</a></p>",
        );
    });
});

describe('TextFormatting.Hashtags with various settings', () => {
    it('Boundary of MinimumHashtagLength', () => {
        expect(TextFormatting.formatText('#疑問', {minimumHashtagLength: 2}, emojiMap).trim()).toBe(
            "<p><a class='mention-link' href='#' data-hashtag='#疑問'>#疑問</a></p>",
        );
        expect(TextFormatting.formatText('This is a sentence #疑問 containing a hashtag', {minimumHashtagLength: 2}, emojiMap).trim()).toBe(
            "<p>This is a sentence <a class='mention-link' href='#' data-hashtag='#疑問'>#疑問</a> containing a hashtag</p>",
        );

        expect(TextFormatting.formatText('#疑', {minimumHashtagLength: 2}, emojiMap).trim()).toBe(
            '<p>#疑</p>',
        );
        expect(TextFormatting.formatText('This is a sentence #疑 containing a hashtag', {minimumHashtagLength: 2}, emojiMap).trim()).toBe(
            '<p>This is a sentence #疑 containing a hashtag</p>',
        );
    });
});
