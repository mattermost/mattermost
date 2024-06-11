// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EmojiMap from 'utils/emoji_map';
import * as TextFormatting from 'utils/text_formatting';
const emojiMap = new EmojiMap(new Map());

describe('TextFormatting.searchHighlighting', () => {
    const testCases = [{
        name: 'no search highlighting',
        input: 'These are words in a sentence.',
        searchMatches: [],
        searchTerm: '',
        expected: '<p>These are words in a sentence.</p>',
    }, {
        name: 'search term highlighting',
        input: 'These are words in a sentence.',
        searchTerm: 'words sentence',
        expected: '<p>These are <span class="search-highlight">words</span> in a <span class="search-highlight">sentence</span>.</p>',
    }, {
        name: 'search term highlighting with quoted phrase',
        input: 'These are words in a sentence. This is a sentence with words.',
        searchTerm: '"words in a sentence"',
        expected: '<p>These are <span class="search-highlight">words in a sentence</span>. This is a sentence with words.</p>',
    }, {
        name: 'search term highlighting with empty quoted phrase',
        input: 'These are words in a sentence. This is a sentence with words.',
        searchTerm: '""',
        expected: '<p>These are words in a sentence. This is a sentence with words.</p>',
    }, {
        name: 'search term highlighting with flags',
        input: 'These are words in a sentence.',
        searchTerm: 'words in:sentence',
        expected: '<p>These are <span class="search-highlight">words</span> in a sentence.</p>',
    }, {
        name: 'search term highlighting with at mentions',
        input: 'These are @words in a @sentence.',
        searchTerm: '@words sentence',
        expected: '<p>These are <span class="search-highlight"><span data-mention="words">@words</span></span> in a <span class="search-highlight"><span data-mention="sentence.">@sentence.</span></span></p>',
    }, {
        name: 'search term highlighting in a code span',
        input: 'These are `words in a sentence`.',
        searchTerm: 'words',
        expected: '<p>These are <span class="codespan__pre-wrap"><code><span class="search-highlight">words</span> in a sentence</code></span>.</p>',
    }, {
        name: 'search term highlighting in a code block',
        input: '```\nwords in a sentence\n```',
        searchTerm: 'words',
        expected:
            '<div data-codeblock-code="words in a sentence" data-codeblock-language="" data-codeblock-searchedcontent="&lt;div class=&quot;post-code__search-highlighting&quot;&gt;&lt;span class=&quot;search-highlight&quot;&gt;words&lt;/span&gt; in a sentence&lt;/div&gt;"></div>',
    }, {
        name: 'search term highlighting in link text',
        input: 'These are [words in a sentence](https://example.com).',
        searchTerm: 'words',
        expected: '<p>These are <a class="theme markdown__link" href="https://example.com" rel="noreferrer" target="_blank"><span class="search-highlight">words</span> in a sentence</a>.</p>',
    }, {
        name: 'search term highlighting in link url',
        input: 'These are [words in a sentence](https://example.com).',
        searchTerm: 'example',
        expected: '<p>These are <a class="theme markdown__link search-highlight" href="https://example.com" rel="noreferrer" target="_blank">words in a sentence</a>.</p>',
    }, {
        name: 'search match highlighting',
        input: 'These are words in a sentence.',
        searchMatches: ['words', 'sentence'],
        expected: '<p>These are <span class="search-highlight">words</span> in a <span class="search-highlight">sentence</span>.</p>',
    }, {
        name: 'search match highlighting with quoted phrase',
        input: 'These are words in a sentence. This is a sentence with words.',
        searchMatches: ['words in a sentence'],
        expected: '<p>These are <span class="search-highlight">words in a sentence</span>. This is a sentence with words.</p>',
    }, {
        name: 'search match highlighting with at mentions',
        input: 'These are @words in a @sentence.',
        searchMatches: ['@words', 'sentence'],
        expected: '<p>These are <span class="search-highlight"><span data-mention="words">@words</span></span> in a <span class="search-highlight"><span data-mention="sentence.">@sentence.</span></span></p>',
    }, {
        name: 'search match highlighting in a code span',
        input: 'These are `words in a sentence`.',
        searchMatches: ['words'],
        expected: '<p>These are <span class="codespan__pre-wrap"><code><span class="search-highlight">words</span> in a sentence</code></span>.</p>',
    }, {
        name: 'search match highlighting in a code block',
        input: '```\nwords in a sentence\n```',
        searchMatches: ['words'],
        expected:
            '<div data-codeblock-code="words in a sentence" data-codeblock-language="" data-codeblock-searchedcontent="&lt;div class=&quot;post-code__search-highlighting&quot;&gt;&lt;span class=&quot;search-highlight&quot;&gt;words&lt;/span&gt; in a sentence&lt;/div&gt;"></div>',
    }, {
        name: 'search match highlighting in link text',
        input: 'These are [words in a sentence](https://example.com).',
        searchMatches: ['words'],
        expected: '<p>These are <a class="theme markdown__link" href="https://example.com" rel="noreferrer" target="_blank"><span class="search-highlight">words</span> in a sentence</a>.</p>',
    }, {
        name: 'search match highlighting in link url',
        input: 'These are [words in a sentence](https://example.com).',
        searchMatches: ['example'],
        expected: '<p>These are <a class="theme markdown__link search-highlight" href="https://example.com" rel="noreferrer" target="_blank">words in a sentence</a>.</p>',
    }];

    for (const testCase of testCases) {
        it(testCase.name, () => {
            const options = {
                atMentions: true,
                mentionHighlight: true,
                searchMatches: testCase.searchMatches,
                searchTerm: testCase.searchTerm || '',
            };
            const output = TextFormatting.formatText(testCase.input, options, emojiMap).trim();

            expect(output).toEqual(testCase.expected);
        });
    }

    it('wildcard highlighting', () => {
        assertTextMatch('foobar', 'foo*', 'foo', 'bar');
        assertTextMatch('foo1bar', 'foo1*', 'foo1', 'bar');
        assertTextMatch('foo_bar', 'foo_*', 'foo_', 'bar');
        assertTextMatch('foo.bar', 'foo.*', 'foo.', 'bar');
        assertTextMatch('foo?bar', 'foo?*', 'foo?', 'bar');
        assertTextMatch('foo bar', 'foo*', 'foo', ' bar');
        assertTextMatch('foo bar', 'foo *', 'foo', ' bar');
        assertTextMatch('foo⺑bar', 'foo⺑*', 'foo⺑', 'bar');

        function assertTextMatch(input: string, search: string, expectedMatch: string, afterMatch: string) {
            expect(TextFormatting.formatText(input, {searchTerm: search}, emojiMap).trim()).
                toEqual(`<p><span class="search-highlight">${expectedMatch}</span>${afterMatch}</p>`);
        }
    });
});
