// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import emojiRegex from 'emoji-regex';

import {getEmojiMap} from 'selectors/emojis';
import store from 'stores/redux_store.jsx';

import EmojiMap from 'utils/emoji_map';
import LinkOnlyRenderer from 'utils/markdown/link_only_renderer';
import {
    formatText,
    autolinkAtMentions,
    highlightSearchTerms,
    handleUnicodeEmoji,
    highlightCurrentMentions,
    parseSearchTerms, autolinkChannelMentions,
} from 'utils/text_formatting';
import type {ChannelNamesMap} from 'utils/text_formatting';

const emptyEmojiMap = new EmojiMap(new Map());

describe('formatText', () => {
    test('jumbo emoji should be able to handle up to 3 spaces before the emoji character', () => {
        const emoji = ':)';
        let spaces = '';

        for (let i = 0; i < 3; i++) {
            spaces += ' ';
            const output = formatText(`${spaces}${emoji}`, {}, emptyEmojiMap);
            expect(output).toBe(`<span class="all-emoji"><p>${spaces}<span data-emoticon="slightly_smiling_face">${emoji}</span></p></span>`);
        }
    });

    test('code blocks newlines are not converted into <br/> with inline markdown image in the post', () => {
        const output = formatText('```\nsome text\nsecond line\n```\n ![](https://example.com/image.png)', {}, emptyEmojiMap);
        expect(output).not.toContain('<br/>');
    });

    test('newlines in post text are converted into <br/> with inline markdown image in the post', () => {
        const output = formatText('some text\nand some more ![](https://example.com/image.png)', {}, emptyEmojiMap);
        expect(output).toContain('<br/>');
    });
});

describe('autolinkAtMentions', () => {
    // testing to make sure @channel, @all & @here are setup properly to get highlighted correctly
    const mentionTestCases = [
        'channel',
        'all',
        'here',
    ];
    function runSuccessfulAtMentionTests(leadingText = '', trailingText = '') {
        mentionTestCases.forEach((testCase) => {
            const mention = `@${testCase}`;
            const text = `${leadingText}${mention}${trailingText}`;
            const tokens = new Map();

            const output = autolinkAtMentions(text, tokens);
            let expected = `${leadingText}$MM_ATMENTION0$${trailingText}`;

            // Deliberately remove all leading underscores since regex replaces underscore by treating it as non word boundary
            while (expected[0] === '_') {
                expected = expected.substring(1);
            }

            expect(output).toBe(expected);
            expect(tokens.get('$MM_ATMENTION0$').value).toBe(`<span data-mention="${testCase}">${mention}</span>`);
        });
    }
    function runUnsuccessfulAtMentionTests(leadingText = '', trailingText = '') {
        mentionTestCases.forEach((testCase) => {
            const mention = `@${testCase}`;
            const text = `${leadingText}${mention}${trailingText}`;
            const tokens = new Map();

            const output = autolinkAtMentions(text, tokens);
            expect(output).toBe(text);
            expect(tokens.get('$MM_ATMENTION0$')).toBeUndefined();
        });
    }
    function runUnsuccessfulAtMentionTestsMatchingNonSpecialMentions(leadingText = '', trailingText = '') {
        mentionTestCases.forEach((testCase) => {
            const mention = `@${testCase}`;
            const text = `${leadingText}${mention}${trailingText}`;
            const tokens = new Map();

            const output = autolinkAtMentions(text, tokens);
            expect(output).toBe(`${leadingText}$MM_ATMENTION0$`);
            expect(tokens.get('$MM_ATMENTION0$').value).toBe(`<span data-mention="${testCase}${trailingText}">${mention}${trailingText}</span>`);
        });
    }

    // cases where highlights should be successful
    test('@channel, @all, @here should highlight properly with no leading or trailing content', () => {
        runSuccessfulAtMentionTests();
    });
    test('@channel, @all, @here should highlight properly with a leading space', () => {
        runSuccessfulAtMentionTests(' ', '');
    });
    test('@channel, @all, @here should highlight properly with a trailing space', () => {
        runSuccessfulAtMentionTests('', ' ');
    });
    test('@channel, @all, @here should highlight properly with a leading period', () => {
        runSuccessfulAtMentionTests('.', '');
    });
    test('@channel, @all, @here should highlight properly with a trailing period', () => {
        runSuccessfulAtMentionTests('', '.');
    });
    test('@channel, @all, @here should highlight properly with multiple leading and trailing periods', () => {
        runSuccessfulAtMentionTests('...', '...');
    });
    test('@channel, @all, @here should highlight properly with a leading dash', () => {
        runSuccessfulAtMentionTests('-', '');
    });
    test('@channel, @all, @here should highlight properly with a trailing dash', () => {
        runSuccessfulAtMentionTests('', '-');
    });
    test('@channel, @all, @here should highlight properly with multiple leading and trailing dashes', () => {
        runSuccessfulAtMentionTests('---', '---');
    });
    test('@channel, @all, @here should highlight properly with a trailing underscore', () => {
        runSuccessfulAtMentionTests('', '____');
    });
    test('@channel, @all, @here should highlight properly with multiple trailing underscores', () => {
        runSuccessfulAtMentionTests('', '____');
    });
    test('@channel, @all, @here should highlight properly within a typical sentance', () => {
        runSuccessfulAtMentionTests('This is a typical sentance, ', ' check out this sentance!');
    });
    test('@channel, @all, @here should highlight with a leading underscore', () => {
        runSuccessfulAtMentionTests('_');
    });

    // cases where highlights should be unsuccessful
    test('@channel, @all, @here should not highlight when the last part of a word', () => {
        runUnsuccessfulAtMentionTests('testing');
    });
    test('@channel, @all, @here should not highlight when in the middle of a word', () => {
        runUnsuccessfulAtMentionTests('test', 'ing');
    });

    // cases where highlights should be unsucessful but a non special mention should be created
    test('@channel, @all, @here should be treated as non special mentions with trailing period followed by a word', () => {
        runUnsuccessfulAtMentionTestsMatchingNonSpecialMentions('Hello ', '.developers');
    });
    test('@channel, @all, @here should be treated as non special mentions with multiple trailing periods followed by a word', () => {
        runUnsuccessfulAtMentionTestsMatchingNonSpecialMentions('Hello ', '...developers');
    });
    test('@channel, @all, @here should be treated as non special mentions with trailing dash followed by a word', () => {
        runUnsuccessfulAtMentionTestsMatchingNonSpecialMentions('Hello ', '-developers');
    });
    test('@channel, @all, @here should be treated as non special mentions with multiple trailing dashes followed by a word', () => {
        runUnsuccessfulAtMentionTestsMatchingNonSpecialMentions('Hello ', '---developers');
    });
    test('@channel, @all, @here should be treated as non special mentions with trailing underscore followed by a word', () => {
        runUnsuccessfulAtMentionTestsMatchingNonSpecialMentions('Hello ', '_developers');
    });
    test('@channel, @all, @here should be treated as non special mentions with multiple trailing underscores followed by a word', () => {
        runUnsuccessfulAtMentionTestsMatchingNonSpecialMentions('Hello ', '___developers');
    });
});

describe('highlightSearchTerms', () => {
    test('hashtags should highlight case-insensitively', () => {
        const text = '$MM_HASHTAG0$';
        const tokens = new Map(
            [['$MM_HASHTAG0$', {
                hashtag: 'Test',
                originalText: '#Test',
                value: '<a class="mention-link" href="#" data-hashtag="#Test">#Test</a>',
            }]],
        );
        const searchPatterns = [
            {
                pattern: /(\W|^)(#test)\b/gi,
                term: '#test',
            },
        ];

        const output = highlightSearchTerms(text, tokens, searchPatterns);
        expect(output).toBe('$MM_SEARCHTERM1$');
        expect(tokens.get('$MM_SEARCHTERM1$')!.value).toBe('<span class="search-highlight">$MM_HASHTAG0$</span>');
    });
});

describe('autolink channel mentions', () => {
    test('link a channel mention', () => {
        const mention = '~test-channel';
        const leadingText = 'pre blah blah ';
        const trailingText = ' post blah blah';
        const text = `${leadingText}${mention}${trailingText}`;
        const tokens = new Map();
        const channelNamesMap: ChannelNamesMap = {
            'test-channel': {
                team_name: 'ad-1',
                display_name: 'Test Channel',
            },
        };

        const output = autolinkChannelMentions(text, tokens, channelNamesMap);
        expect(output).toBe(`${leadingText}$MM_CHANNELMENTION0$${trailingText}`);
        expect(tokens.get('$MM_CHANNELMENTION0$').value).toBe('<a class="mention-link" href="/ad-1/channels/test-channel" data-channel-mention-team="ad-1" data-channel-mention="test-channel">~Test Channel</a>');
    });
});

describe('handleUnicodeEmoji', () => {
    const emojiMap = getEmojiMap(store.getState());
    const UNICODE_EMOJI_REGEX = emojiRegex();

    const tests = [
        {
            description: 'should replace supported emojis with an image',
            text: '👍',
            output: '<span data-emoticon="+1">👍</span>',
        },
        {
            description: 'should not replace unsupported emojis with an image',
            text: '😮‍💨', // Note, this test will fail as soon as this emoji gets a corresponding image
            output: '<span class="emoticon emoticon--unicode">😮‍💨</span>',
        },
        {
            description: 'should correctly match gendered emojis',
            text: '🙅‍♀️🙅‍♂️',
            output: '<span data-emoticon="woman-gesturing-no">🙅‍♀️</span><span data-emoticon="man-gesturing-no">🙅‍♂️</span>',
        },
        {
            description: 'should correctly match flags',
            text: '🏳️🇨🇦🇫🇮',
            output: '<span data-emoticon="waving_white_flag">🏳️</span><span data-emoticon="flag-ca">🇨🇦</span><span data-emoticon="flag-fi">🇫🇮</span>',
        },
        {
            description: 'should correctly match emojis with skin tones',
            text: '👍🏿👍🏻',
            output: '<span data-emoticon="+1_dark_skin_tone">👍🏿</span><span data-emoticon="+1_light_skin_tone">👍🏻</span>',
        },
        {
            description: 'should correctly match more emojis with skin tones',
            text: '✊🏻✊🏿',
            output: '<span data-emoticon="fist_light_skin_tone">✊🏻</span><span data-emoticon="fist_dark_skin_tone">✊🏿</span>',
        },
        {
            description: 'should correctly match combined emojis',
            text: '👨‍👩‍👧‍👦👨‍❤️‍👨',
            output: '<span data-emoticon="man-woman-girl-boy">👨‍👩‍👧‍👦</span><span data-emoticon="man-heart-man">👨‍❤️‍👨</span>',
        },
    ];

    for (const t of tests) {
        test(t.description, () => {
            const output = handleUnicodeEmoji(t.text, emojiMap, UNICODE_EMOJI_REGEX);
            expect(output).toBe(t.output);
        });
    }

    test('without emojiMap, should work as unsupported emoji', () => {
        const output = handleUnicodeEmoji('👍', undefined as unknown as EmojiMap, UNICODE_EMOJI_REGEX);
        expect(output).toBe('<span class="emoticon emoticon--unicode">👍</span>');
    });
});

describe('linkOnlyMarkdown', () => {
    const options = {markdown: false, renderer: new LinkOnlyRenderer()};
    test('link without a title', () => {
        const text = 'Do you like https://www.mattermost.com?';
        const output = formatText(text, options, emptyEmojiMap);
        expect(output).toBe(
            'Do you like <a class="theme markdown__link" href="https://www.mattermost.com" target="_blank">' +
            'https://www.mattermost.com</a>?');
    });
    test('link with a title', () => {
        const text = 'Do you like [Mattermost](https://www.mattermost.com)?';
        const output = formatText(text, options, emptyEmojiMap);
        expect(output).toBe(
            'Do you like <a class="theme markdown__link" href="https://www.mattermost.com" target="_blank">' +
            'Mattermost</a>?');
    });
    test('link with header signs to skip', () => {
        const text = '#### Do you like [Mattermost](https://www.mattermost.com)?';
        const output = formatText(text, options, emptyEmojiMap);
        expect(output).toBe(
            'Do you like <a class="theme markdown__link" href="https://www.mattermost.com" target="_blank">' +
            'Mattermost</a>?');
    });
});

describe('highlightCurrentMentions', () => {
    const tokens = new Map();
    const mentionKeys = [
        {key: '메터모스트'}, // Korean word
        {key: 'マッターモスト'}, // Japanese word
        {key: 'маттермост'}, // Russian word
        {key: 'Mattermost'}, // Latin word
    ];

    it('should find and match Korean, Japanese, latin and Russian words', () => {
        const text = '메터모스트, notinkeys, マッターモスト, маттермост!, Mattermost, notinkeys';
        const highlightedText = highlightCurrentMentions(text, tokens, mentionKeys);

        const expectedOutput = '$MM_SELFMENTION0$, notinkeys, $MM_SELFMENTION1$, $MM_SELFMENTION2$!, $MM_SELFMENTION3$, notinkeys';

        // note that the string output $MM_SELFMENTION{idx} will be used by doFormatText to add the highlight later in the format process
        expect(highlightedText).toContain(expectedOutput);
    });
});

describe('parseSearchTerms', () => {
    const tests = [
        {
            description: 'no input',
            input: undefined as unknown as string,
            expected: [],
        },
        {
            description: 'empty input',
            input: '',
            expected: [],
        },
        {
            description: 'simple word',
            input: 'someword',
            expected: ['someword'],
        },
        {
            description: 'simple phrase',
            input: '"some phrase"',
            expected: ['some phrase'],
        },
        {
            description: 'empty phrase',
            input: '""',
            expected: [],
        },
        {
            description: 'phrase before word',
            input: '"some phrase" someword',
            expected: ['some phrase', 'someword'],
        },
        {
            description: 'word before phrase',
            input: 'someword "some phrase"',
            expected: ['someword', 'some phrase'],
        },
        {
            description: 'words and phrases',
            input: 'someword "some phrase" otherword "other phrase"',
            expected: ['someword', 'some phrase', 'otherword', 'other phrase'],
        },
        {
            description: 'with search flags after',
            input: 'someword "some phrase" from:someone in:somechannel',
            expected: ['someword', 'some phrase'],
        },
        {
            description: 'with search flags before',
            input: 'from:someone in: channel someword "some phrase"',
            expected: ['someword', 'some phrase'],
        },
        {
            description: 'with search flags before and after',
            input: 'from:someone someword "some phrase" in:somechannel',
            expected: ['someword', 'some phrase'],
        },
        {
            description: 'with date search flags before and after',
            input: 'on:1970-01-01 someword "some phrase" after:1970-01-01 before: 1970-01-01',
            expected: ['someword', 'some phrase'],
        },
        {
            description: 'with negative search flags after',
            input: 'someword "some phrase" -from:someone -in:somechannel',
            expected: ['someword', 'some phrase'],
        },
        {
            description: 'with negative search flags before',
            input: '-from:someone -in: channel someword "some phrase"',
            expected: ['someword', 'some phrase'],
        },
        {
            description: 'with negative search flags before and after',
            input: '-from:someone someword "some phrase" -in:somechannel',
            expected: ['someword', 'some phrase'],
        },
        {
            description: 'with negative date search flags before and after',
            input: '-on:1970-01-01 someword "some phrase" -after:1970-01-01 -before: 1970-01-01',
            expected: ['someword', 'some phrase'],
        },
    ];

    for (const t of tests) {
        test(t.description, () => {
            const output = parseSearchTerms(t.input);
            expect(output).toStrictEqual(t.expected);
        });
    }
});
