// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';

import {Preferences} from 'mattermost-redux/constants';

import enMessages from 'i18n/en.json';
import {PostListRowListIds, Constants} from 'utils/constants';
import EmojiMap from 'utils/emoji_map';
import * as PostUtils from 'utils/post_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

describe('PostUtils.containsAtChannel', () => {
    test('should return correct @all (same for @channel)', () => {
        for (const data of [
            {
                text: '',
                result: false,
            },
            {
                text: 'all',
                result: false,
            },
            {
                text: '@allison',
                result: false,
            },
            {
                text: '@ALLISON',
                result: false,
            },
            {
                text: '@all123',
                result: false,
            },
            {
                text: '123@all',
                result: false,
            },
            {
                text: 'hey@all',
                result: false,
            },
            {
                text: 'hey@all.com',
                result: false,
            },
            {
                text: '@all',
                result: true,
            },
            {
                text: '@ALL',
                result: true,
            },
            {
                text: '@all hey',
                result: true,
            },
            {
                text: 'hey @all',
                result: true,
            },
            {
                text: 'HEY @ALL',
                result: true,
            },
            {
                text: 'hey @all!',
                result: true,
            },
            {
                text: 'hey @all:+1:',
                result: true,
            },
            {
                text: 'hey @ALL:+1:',
                result: true,
            },
            {
                text: '`@all`',
                result: false,
            },
            {
                text: '@someone `@all`',
                result: false,
            },
            {
                text: '``@all``',
                result: false,
            },
            {
                text: '```@all```',
                result: false,
            },
            {
                text: '```\n@all\n```',
                result: false,
            },
            {
                text: '```````\n@all\n```````',
                result: false,
            },
            {
                text: '```code\n@all\n```',
                result: false,
            },
            {
                text: '~~~@all~~~',
                result: true,
            },
            {
                text: '~~~\n@all\n~~~',
                result: false,
            },
            {
                text: ' /not_cmd @all',
                result: true,
            },
            {
                text: '/cmd @all',
                result: false,
            },
            {
                text: '/cmd @all test',
                result: false,
            },
            {
                text: '/cmd test @all',
                result: false,
            },
            {
                text: '@channel',
                result: true,
            },
            {
                text: '@channel.',
                result: true,
            },
            {
                text: '@channel/test',
                result: true,
            },
            {
                text: 'test/@channel',
                result: true,
            },
            {
                text: '@all/@channel',
                result: true,
            },
            {
                text: '@cha*nnel*',
                result: false,
            },
            {
                text: '@cha**nnel**',
                result: false,
            },
            {
                text: '*@cha*nnel',
                result: false,
            },
            {
                text: '[@chan](https://google.com)nel',
                result: false,
            },
            {
                text: '@cha![](https://myimage)nnel',
                result: false,
            },
            {
                text: '@here![](https://myimage)nnel',
                result: true,
                options: {
                    checkAllMentions: true,
                },
            },
            {
                text: '@heree',
                result: false,
                options: {
                    checkAllMentions: true,
                },
            },
            {
                text: '=@here=',
                result: true,
                options: {
                    checkAllMentions: true,
                },
            },
            {
                text: '@HERE',
                result: true,
                options: {
                    checkAllMentions: true,
                },
            },
            {
                text: '@here',
                result: false,
                options: {
                    checkAllMentions: false,
                },
            },
        ]) {
            const containsAtChannel = PostUtils.containsAtChannel(data.text, data.options);

            expect(containsAtChannel).toEqual(data.result);
        }
    });
});

describe('PostUtils.specialMentionsInText', () => {
    test('should return correct mentions', () => {
        for (const data of [
            {
                text: '',
                result: {all: false, channel: false, here: false},
            },
            {
                text: 'all',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '@allison',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '@ALLISON',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '@all123',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '123@all',
                result: {all: false, channel: false, here: false},
            },
            {
                text: 'hey@all',
                result: {all: false, channel: false, here: false},
            },
            {
                text: 'hey@all.com',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '@all',
                result: {all: true, channel: false, here: false},
            },
            {
                text: '@ALL',
                result: {all: true, channel: false, here: false},
            },
            {
                text: '@all hey',
                result: {all: true, channel: false, here: false},
            },
            {
                text: 'hey @all',
                result: {all: true, channel: false, here: false},
            },
            {
                text: 'HEY @ALL',
                result: {all: true, channel: false, here: false},
            },
            {
                text: 'hey @all!',
                result: {all: true, channel: false, here: false},
            },
            {
                text: 'hey @all:+1:',
                result: {all: true, channel: false, here: false},
            },
            {
                text: 'hey @ALL:+1:',
                result: {all: true, channel: false, here: false},
            },
            {
                text: '`@all`',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '@someone `@all`',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '``@all``',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '```@all```',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '```\n@all\n```',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '```````\n@all\n```````',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '```code\n@all\n```',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '~~~@all~~~',
                result: {all: true, channel: false, here: false},
            },
            {
                text: '~~~\n@all\n~~~',
                result: {all: false, channel: false, here: false},
            },
            {
                text: ' /not_cmd @all',
                result: {all: true, channel: false, here: false},
            },
            {
                text: '/cmd @all',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '/cmd @all test',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '/cmd test @all',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '@channel',
                result: {all: false, channel: true, here: false},
            },
            {
                text: '@channel.',
                result: {all: false, channel: true, here: false},
            },
            {
                text: '@channel/test',
                result: {all: false, channel: true, here: false},
            },
            {
                text: 'test/@channel',
                result: {all: false, channel: true, here: false},
            },
            {
                text: '@all/@channel',
                result: {all: true, channel: true, here: false},
            },
            {
                text: '@cha*nnel*',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '@cha**nnel**',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '*@cha*nnel',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '[@chan](https://google.com)nel',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '@cha![](https://myimage)nnel',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '@here![](https://myimage)nnel',
                result: {all: false, channel: false, here: true},
            },
            {
                text: '@heree',
                result: {all: false, channel: false, here: false},
            },
            {
                text: '=@here=',
                result: {all: false, channel: false, here: true},
            },
            {
                text: '@HERE',
                result: {all: false, channel: false, here: true},
            },
            {
                text: '@all @here',
                result: {all: true, channel: false, here: true},
            },
            {
                text: 'message @all message @here message @channel',
                result: {all: true, here: true, channel: true},
            },
        ]) {
            const mentions = PostUtils.specialMentionsInText(data.text);
            expect(mentions).toEqual(data.result);
        }
    });
});

describe('PostUtils.shouldFocusMainTextbox', () => {
    test('basic cases', () => {
        for (const data of [
            {
                event: null,
                expected: false,
            },
            {
                event: {},
                expected: false,
            },
            {
                event: {ctrlKey: true},
                activeElement: {tagName: 'BODY'},
                expected: false,
            },
            {
                event: {metaKey: true},
                activeElement: {tagName: 'BODY'},
                expected: false,
            },
            {
                event: {altKey: true},
                activeElement: {tagName: 'BODY'},
                expected: false,
            },
            {
                event: {},
                activeElement: {tagName: 'BODY'},
                expected: false,
            },
            {
                event: {key: 'a'},
                activeElement: {tagName: 'BODY'},
                expected: true,
            },
            {
                event: {key: 'a'},
                activeElement: {tagName: 'INPUT'},
                expected: false,
            },
            {
                event: {key: 'a'},
                activeElement: {tagName: 'TEXTAREA'},
                expected: false,
            },
            {
                event: {key: '0'},
                activeElement: {tagName: 'BODY'},
                expected: true,
            },
            {
                event: {key: '!'},
                activeElement: {tagName: 'BODY'},
                expected: true,
            },
            {
                event: {key: ' '},
                activeElement: {tagName: 'BODY'},
                expected: true,
            },
            {
                event: {key: 'BACKSPACE'},
                activeElement: {tagName: 'BODY'},
                expected: false,
            },
        ]) {
            const shouldFocus = PostUtils.shouldFocusMainTextbox(data.event as unknown as KeyboardEvent, data.activeElement as unknown as Element);
            expect(shouldFocus).toEqual(data.expected);
        }
    });
});

describe('PostUtils.postMessageOnKeyPress', () => {
    // null/empty cases
    const emptyCases = [{
        name: 'null/empty: Test for null event',
        input: {event: null, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: false},
    }, {
        name: 'null/empty: Test for empty message',
        input: {event: {}, message: '', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: false},
    }, {
        name: 'null/empty: Test for shiftKey event',
        input: {event: {shiftKey: true}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: false},
    }, {
        name: 'null/empty: Test for altKey event',
        input: {event: {altKey: true}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: false},
    }];

    for (const testCase of emptyCases) {
        it(testCase.name, () => {
            const output = PostUtils.postMessageOnKeyPress(
                testCase.input.event as any,
                testCase.input.message,
                testCase.input.sendMessageOnCtrlEnter,
                testCase.input.sendCodeBlockOnCtrlEnter,
                0,
                0,
                testCase.input.message.length,
            );

            expect(output).toEqual(testCase.expected);
        });
    }

    // no override case
    const noOverrideCases = [{
        name: 'no override: Test no override setting',
        input: {event: {keyCode: 13}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true},
    }, {
        name: 'no override: empty message',
        input: {event: {keyCode: 13}, message: '', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true},
    }, {
        name: 'no override: empty message on ctrl + enter',
        input: {event: {keyCode: 13}, message: '', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true},
    }];

    for (const testCase of noOverrideCases) {
        it(testCase.name, () => {
            const output = PostUtils.postMessageOnKeyPress(
                testCase.input.event as any,
                testCase.input.message,
                testCase.input.sendMessageOnCtrlEnter,
                testCase.input.sendCodeBlockOnCtrlEnter,
                0,
                0,
                testCase.input.message.length,
            );

            expect(output).toEqual(testCase.expected);
        });
    }

    // on sending of message on Ctrl + Enter
    const sendMessageOnCtrlEnterCases = [{
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, no ctrlKey|metaKey',
        input: {event: {keyCode: 13}, message: 'message', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: false},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, no ctrlKey|metaKey, with opening backticks',
        input: {event: {keyCode: 13}, message: '```', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: false},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, no ctrlKey|metaKey, with opening backticks',
        input: {event: {keyCode: 13}, message: '```\nfunc(){}', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: false},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, no ctrlKey|metaKey, with opening backticks',
        input: {event: {keyCode: 13}, message: '```\nfunc(){}\n', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: false},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, no ctrlKey|metaKey, with opening and closing backticks',
        input: {event: {keyCode: 13}, message: '```\nfunc(){}\n```', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: false},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, with ctrlKey',
        input: {event: {keyCode: 13, ctrlKey: true}, message: 'message', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, with metaKey',
        input: {event: {keyCode: 13, metaKey: true}, message: 'message', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, with ctrlKey, with opening backticks',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, with ctrlKey, with opening backticks, with language set',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```javascript', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, with ctrlKey, with opening backticks',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```\n', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, with ctrlKey, with opening backticks',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```\nfunction(){}', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true, message: '```\nfunction(){}\n```', withClosedCodeBlock: true},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, with ctrlKey, with opening backticks, with line break on last line',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```\nfunction(){}\n', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true, message: '```\nfunction(){}\n```', withClosedCodeBlock: true},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, with ctrlKey, with opening backticks, with multiple line breaks on last lines',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```\nfunction(){}\n\n\n', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true, message: '```\nfunction(){}\n\n\n```', withClosedCodeBlock: true},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, with ctrlKey, with opening and closing backticks',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```\nfunction(){}\n```', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, with ctrlKey, with opening and closing backticks, with language set',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```javascript\nfunction(){}\n```', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true},
    }, {
        name: 'sendMessageOnCtrlEnter: Test for overriding sending of message on CTRL+ENTER, with ctrlKey, with inline opening backticks',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '``` message', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true},
    }];

    for (const testCase of sendMessageOnCtrlEnterCases) {
        it(testCase.name, () => {
            const output = PostUtils.postMessageOnKeyPress(
                testCase.input.event as any,
                testCase.input.message,
                testCase.input.sendMessageOnCtrlEnter,
                testCase.input.sendCodeBlockOnCtrlEnter,
                0,
                0,
                testCase.input.message.length,
            );

            expect(output).toEqual(testCase.expected);
        });
    }

    // on sending and/or closing of code block on Ctrl + Enter
    const sendCodeBlockOnCtrlEnterCases = [{
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, no ctrlKey|metaKey, without opening backticks',
        input: {event: {keyCode: 13}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, no ctrlKey|metaKey, with opening backticks',
        input: {event: {keyCode: 13}, message: '```', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: false},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, no ctrlKey|metaKey, with opening backticks',
        input: {event: {keyCode: 13}, message: '```javascript', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: false},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, no ctrlKey|metaKey, with opening backticks',
        input: {event: {keyCode: 13}, message: '```javascript\n', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: false},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, no ctrlKey|metaKey, with opening backticks',
        input: {event: {keyCode: 13}, message: '```javascript\n    function(){}', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: false},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, without opening backticks',
        input: {event: {keyCode: 13, ctrlKey: true}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with metaKey, without opening backticks',
        input: {event: {keyCode: 13, metaKey: true}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with line break',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '\n', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with multiple line breaks',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '\n\n\n', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with opening backticks',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with opening backticks, with language set',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```javascript', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with opening and closing backticks, with language set',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```javascript\n    function(){}\n```', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with opening and closing backticks',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```\n    function(){}\n```', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with opening backticks, with last line of empty spaces',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```javascript\n    function(){}\n    ', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true, message: '```javascript\n    function(){}\n    \n```', withClosedCodeBlock: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with opening backticks, with empty line break on last line',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```javascript\n    function(){}\n', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true, message: '```javascript\n    function(){}\n```', withClosedCodeBlock: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with opening backticks, with multiple empty line breaks on last lines',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```javascript\n    function(){}\n\n\n', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true, message: '```javascript\n    function(){}\n\n\n```', withClosedCodeBlock: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with opening backticks, with multiple empty line breaks and spaces on last lines',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```javascript\n    function(){}\n    \n\n    ', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true, message: '```javascript\n    function(){}\n    \n\n    \n```', withClosedCodeBlock: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with opening backticks, without line break on last line',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '```javascript\n    function(){}', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true},
        expected: {allowSending: true, message: '```javascript\n    function(){}\n```', withClosedCodeBlock: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with inline opening backticks',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '``` message', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: false},
        expected: {allowSending: true},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, no ctrlKey|metaKey, with cursor between backticks',
        input: {event: {keyCode: 13, ctrlKey: false}, message: '``` message ```', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: true, cursorPosition: 5},
        expected: {allowSending: false},
    }, {
        name: 'sendCodeBlockOnCtrlEnter: Test for overriding sending of code block on CTRL+ENTER, with ctrlKey, with cursor between backticks',
        input: {event: {keyCode: 13, ctrlKey: true}, message: '``` message ```', sendMessageOnCtrlEnter: true, sendCodeBlockOnCtrlEnter: true, cursorPosition: 5},
        expected: {allowSending: true},
    }];

    for (const testCase of sendCodeBlockOnCtrlEnterCases) {
        it(testCase.name, () => {
            const output = PostUtils.postMessageOnKeyPress(
                testCase.input.event as any,
                testCase.input.message,
                testCase.input.sendMessageOnCtrlEnter,
                testCase.input.sendCodeBlockOnCtrlEnter,
                0,
                0,
                testCase.input.cursorPosition ? testCase.input.cursorPosition : testCase.input.message.length,
            );

            expect(output).toEqual(testCase.expected);
        });
    }

    // on sending within channel threshold
    const channelThresholdCases = [{
        name: 'now unspecified, last channel switch unspecified',
        input: {event: {keyCode: 13}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true, now: 0, lastChannelSwitch: 0},
        expected: {allowSending: true},
    }, {
        name: 'now specified, last channel switch unspecified',
        input: {event: {keyCode: 13}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true, now: 1541658920334, lastChannelSwitch: 0},
        expected: {allowSending: true},
    }, {
        name: 'now specified, last channel switch unspecified',
        input: {event: {keyCode: 13}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true, now: 0, lastChannelSwitch: 1541658920334},
        expected: {allowSending: true},
    }, {
        name: 'last channel switch within threshold',
        input: {event: {keyCode: 13}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true, now: 1541658920334, lastChannelSwitch: 1541658920334 - 250},
        expected: {allowSending: false, ignoreKeyPress: true},
    }, {
        name: 'last channel switch at threshold',
        input: {event: {keyCode: 13}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true, now: 1541658920334, lastChannelSwitch: 1541658920334 - 500},
        expected: {allowSending: false, ignoreKeyPress: true},
    }, {
        name: 'last channel switch outside threshold',
        input: {event: {keyCode: 13}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true, now: 1541658920334, lastChannelSwitch: 1541658920334 - 501},
        expected: {allowSending: true},
    }, {
        name: 'last channel switch well outside threshold',
        input: {event: {keyCode: 13}, message: 'message', sendMessageOnCtrlEnter: false, sendCodeBlockOnCtrlEnter: true, now: 1541658920334, lastChannelSwitch: 1541658920334 - 1500},
        expected: {allowSending: true},
    }];

    for (const testCase of channelThresholdCases) {
        it(testCase.name, () => {
            const output = PostUtils.postMessageOnKeyPress(
                testCase.input.event as any,
                testCase.input.message,
                testCase.input.sendMessageOnCtrlEnter,
                testCase.input.sendCodeBlockOnCtrlEnter,
                testCase.input.now,
                testCase.input.lastChannelSwitch,
                testCase.input.message.length,
            );

            expect(output).toEqual(testCase.expected);
        });
    }
});

describe('PostUtils.getOldestPostId', () => {
    test('Should not return LOAD_OLDER_MESSAGES_TRIGGER', () => {
        const postId = PostUtils.getOldestPostId(['postId1', 'postId2', PostListRowListIds.LOAD_OLDER_MESSAGES_TRIGGER]);
        expect(postId).toEqual('postId2');
    });

    test('Should not return OLDER_MESSAGES_LOADER', () => {
        const postId = PostUtils.getOldestPostId(['postId1', 'postId2', PostListRowListIds.OLDER_MESSAGES_LOADER]);
        expect(postId).toEqual('postId2');
    });

    test('Should not return CHANNEL_INTRO_MESSAGE', () => {
        const postId = PostUtils.getOldestPostId(['postId1', 'postId2', PostListRowListIds.CHANNEL_INTRO_MESSAGE]);
        expect(postId).toEqual('postId2');
    });

    test('Should not return dateline', () => {
        const postId = PostUtils.getOldestPostId(['postId1', 'postId2', 'date-1558290600000']);
        expect(postId).toEqual('postId2');
    });

    test('Should not return START_OF_NEW_MESSAGES', () => {
        const postId = PostUtils.getOldestPostId(['postId1', 'postId2', PostListRowListIds.START_OF_NEW_MESSAGES]);
        expect(postId).toEqual('postId2');
    });
});

describe('PostUtils.getPreviousPostId', () => {
    test('Should skip dateline', () => {
        const postId = PostUtils.getPreviousPostId(['postId1', 'postId2', 'date-1558290600000', 'postId3'], 1);
        expect(postId).toEqual('postId3');
    });

    test('Should skip START_OF_NEW_MESSAGES', () => {
        const postId = PostUtils.getPreviousPostId(['postId1', 'postId2', PostListRowListIds.START_OF_NEW_MESSAGES, 'postId3'], 1);
        expect(postId).toEqual('postId3');
    });

    test('Should return first postId from combined system messages', () => {
        const postId = PostUtils.getPreviousPostId(['postId1', 'postId2', 'user-activity-post1_post2_post3', 'postId3'], 1);
        expect(postId).toEqual('post1');
    });
});

describe('PostUtils.getLatestPostId', () => {
    test('Should not return LOAD_OLDER_MESSAGES_TRIGGER', () => {
        const postId = PostUtils.getLatestPostId([PostListRowListIds.LOAD_OLDER_MESSAGES_TRIGGER, 'postId1', 'postId2']);
        expect(postId).toEqual('postId1');
    });

    test('Should not return OLDER_MESSAGES_LOADER', () => {
        const postId = PostUtils.getLatestPostId([PostListRowListIds.OLDER_MESSAGES_LOADER, 'postId1', 'postId2']);
        expect(postId).toEqual('postId1');
    });

    test('Should not return CHANNEL_INTRO_MESSAGE', () => {
        const postId = PostUtils.getLatestPostId([PostListRowListIds.CHANNEL_INTRO_MESSAGE, 'postId1', 'postId2']);
        expect(postId).toEqual('postId1');
    });

    test('Should not return dateline', () => {
        const postId = PostUtils.getLatestPostId(['date-1558290600000', 'postId1', 'postId2']);
        expect(postId).toEqual('postId1');
    });

    test('Should not return START_OF_NEW_MESSAGES', () => {
        const postId = PostUtils.getLatestPostId([PostListRowListIds.START_OF_NEW_MESSAGES, 'postId1', 'postId2']);
        expect(postId).toEqual('postId1');
    });

    test('Should return first postId from combined system messages', () => {
        const postId = PostUtils.getLatestPostId(['user-activity-post1_post2_post3', 'postId1', 'postId2']);
        expect(postId).toEqual('post1');
    });
});

describe('PostUtils.createAriaLabelForPost', () => {
    const emojiMap = new EmojiMap(new Map());
    const users = {
        'benjamin.cooke': TestHelper.getUserMock({
            username: 'benjamin.cooke',
            nickname: 'sysadmin',
            first_name: 'Benjamin',
            last_name: 'Cooke',
        }),
    };
    const teammateNameDisplaySetting = 'username';

    test('Should show username, timestamp, message, attachments, reactions, flagged and pinned', () => {
        const intl = createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'});

        const testPost = TestHelper.getPostMock({
            message: 'test_message',
            create_at: (new Date().getTime() / 1000) || 0,
            props: {
                attachments: [
                    {i: 'am attachment 1'},
                    {and: 'i am attachment 2'},
                ],
            },
            file_ids: ['test_file_id_1'],
            is_pinned: true,
        });
        const author = 'test_author';
        const reactions = {
            reaction1: TestHelper.getReactionMock({emoji_name: 'reaction 1'}),
            reaction2: TestHelper.getReactionMock({emoji_name: 'reaction 2'}),
        };
        const isFlagged = true;

        const ariaLabel = PostUtils.createAriaLabelForPost(testPost, author, isFlagged, reactions, intl, emojiMap, users, teammateNameDisplaySetting);
        expect(ariaLabel.indexOf(author)).not.toBe(-1);
        expect(ariaLabel.indexOf(testPost.message)).not.toBe(-1);
        expect(ariaLabel.indexOf('3 attachments')).not.toBe(-1);
        expect(ariaLabel.indexOf('2 reactions')).not.toBe(-1);
        expect(ariaLabel.indexOf('message is saved and pinned')).not.toBe(-1);
    });

    test('Should show that message is a reply', () => {
        const intl = createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'});

        const testPost = TestHelper.getPostMock({
            message: 'test_message',
            root_id: 'test_id',
            create_at: (new Date().getTime() / 1000) || 0,
        });
        const author = 'test_author';
        const reactions = {};
        const isFlagged = true;

        const ariaLabel = PostUtils.createAriaLabelForPost(testPost, author, isFlagged, reactions, intl, emojiMap, users, teammateNameDisplaySetting);
        expect(ariaLabel.indexOf('replied')).not.toBe(-1);
    });

    test('Should translate emoji into {emoji-name} emoji', () => {
        const intl = createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'});

        const testPost = TestHelper.getPostMock({
            message: 'emoji_test :smile: :+1: :non-potable_water: :space emoji: :not_an_emoji:',
            create_at: (new Date().getTime() / 1000) || 0,
        });
        const author = 'test_author';
        const reactions = {};
        const isFlagged = true;

        const ariaLabel = PostUtils.createAriaLabelForPost(testPost, author, isFlagged, reactions, intl, emojiMap, users, teammateNameDisplaySetting);
        expect(ariaLabel.indexOf('smile emoji')).not.toBe(-1);
        expect(ariaLabel.indexOf('+1 emoji')).not.toBe(-1);
        expect(ariaLabel.indexOf('non-potable water emoji')).not.toBe(-1);
        expect(ariaLabel.indexOf(':space emoji:')).not.toBe(-1);
        expect(ariaLabel.indexOf(':not_an_emoji:')).not.toBe(-1);
    });

    test('Generating aria label should not break if message is undefined', () => {
        const intl = createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'});

        const testPost = TestHelper.getPostMock({
            id: '32',
            message: undefined,
            create_at: (new Date().getTime() / 1000) || 0,
        });
        const author = 'test_author';
        const reactions = {};
        const isFlagged = true;

        expect(() => PostUtils.createAriaLabelForPost(testPost, author, isFlagged, reactions, intl, emojiMap, users, teammateNameDisplaySetting)).not.toThrow();
    });

    test('Should not mention reactions if passed an empty object', () => {
        const intl = createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'});

        const testPost = TestHelper.getPostMock({
            message: 'test_message',
            root_id: 'test_id',
            create_at: (new Date().getTime() / 1000) || 0,
        });
        const author = 'test_author';
        const reactions = {};
        const isFlagged = true;

        const ariaLabel = PostUtils.createAriaLabelForPost(testPost, author, isFlagged, reactions, intl, emojiMap, users, teammateNameDisplaySetting);
        expect(ariaLabel.indexOf('reaction')).toBe(-1);
    });

    test('Should show the username as mention name in the message', () => {
        const intl = createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'});

        const testPost = TestHelper.getPostMock({
            message: 'test_message @benjamin.cooke',
            root_id: 'test_id',
            create_at: (new Date().getTime() / 1000) || 0,
        });
        const author = 'test_author';
        const reactions = {};
        const isFlagged = true;

        const ariaLabel = PostUtils.createAriaLabelForPost(testPost, author, isFlagged, reactions, intl, emojiMap, users, teammateNameDisplaySetting);
        expect(ariaLabel.indexOf('@benjamin.cooke')).not.toBe(-1);
    });

    test('Should show the nickname as mention name in the message', () => {
        const intl = createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'});

        const testPost = TestHelper.getPostMock({
            message: 'test_message @benjamin.cooke',
            root_id: 'test_id',
            create_at: (new Date().getTime() / 1000) || 0,
        });
        const author = 'test_author';
        const reactions = {};
        const isFlagged = true;

        const ariaLabel = PostUtils.createAriaLabelForPost(testPost, author, isFlagged, reactions, intl, emojiMap, users, 'nickname_full_name');
        expect(ariaLabel.indexOf('@sysadmin')).not.toBe(-1);
    });
});

describe('PostUtils.splitMessageBasedOnCaretPosition', () => {
    const state = {
        caretPosition: 2,
    };

    const message = 'Test Message';
    it('should return an object with two strings when given context and message', () => {
        const stringPieces = PostUtils.splitMessageBasedOnCaretPosition(state.caretPosition, message);
        expect('Te').toEqual(stringPieces.firstPiece);
        expect('st Message').toEqual(stringPieces.lastPiece);
    });
});

describe('PostUtils.splitMessageBasedOnTextSelection', () => {
    const cases: Array<[number, number, string, {firstPiece: string; lastPiece: string}]> = [
        [0, 0, 'Test Replace Message', {firstPiece: '', lastPiece: 'Test Replace Message'}],
        [20, 20, 'Test Replace Message', {firstPiece: 'Test Replace Message', lastPiece: ''}],
        [0, 20, 'Test Replace Message', {firstPiece: '', lastPiece: ''}],
        [0, 10, 'Test Replace Message', {firstPiece: '', lastPiece: 'ce Message'}],
        [5, 12, 'Test Replace Message', {firstPiece: 'Test ', lastPiece: ' Message'}],
        [7, 20, 'Test Replace Message', {firstPiece: 'Test Re', lastPiece: ''}],
    ];

    test.each(cases)('should return an object with two strings when given context and message', (start, end, message, expected) => {
        expect(PostUtils.splitMessageBasedOnTextSelection(start, end, message)).toEqual(expected);
    });
});

describe('PostUtils.getPostURL', () => {
    const currentTeam = TestHelper.getTeamMock({id: 'current_team_id', name: 'current_team_name'});
    const team = TestHelper.getTeamMock({id: 'team_id_1', name: 'team_1'});

    const dmChannel = TestHelper.getChannelMock({id: 'dm_channel_id', name: 'current_user_id__user_id_1', type: Constants.DM_CHANNEL as 'D', team_id: ''});
    const gmChannel = TestHelper.getChannelMock({id: 'gm_channel_id', name: 'gm_channel_name', type: Constants.GM_CHANNEL as 'G', team_id: ''});
    const channel = TestHelper.getChannelMock({id: 'channel_id', name: 'channel_name', team_id: team.id});

    const dmPost = TestHelper.getPostMock({id: 'dm_post_id', channel_id: dmChannel.id});
    const gmPost = TestHelper.getPostMock({id: 'gm_post_id', channel_id: gmChannel.id});
    const post = TestHelper.getPostMock({id: 'post_id', channel_id: channel.id});
    const dmReply = TestHelper.getPostMock({id: 'dm_reply_id', root_id: 'root_post_id_1', channel_id: dmChannel.id});
    const gmReply = TestHelper.getPostMock({id: 'gm_reply_id', root_id: 'root_post_id_1', channel_id: gmChannel.id});
    const reply = TestHelper.getPostMock({id: 'reply_id', root_id: 'root_post_id_1', channel_id: channel.id});

    const getState = (collapsedThreads: boolean) => ({
        entities: {
            general: {
                config: {
                    CollapsedThreads: 'default_off',
                },
            },
            preferences: {
                myPreferences: {
                    [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.COLLAPSED_REPLY_THREADS}`]: {
                        value: collapsedThreads ? 'on' : 'off',
                    },
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    user_id_1: {
                        id: 'user_id_1',
                        username: 'jessicahyde',
                    },
                    current_user_id: {
                        id: 'current_user_id',
                        username: 'currentuser',
                    },
                },
            },
            channels: {
                channels: {
                    gm_channel_id: gmChannel,
                    dm_channel_id: dmChannel,
                    channel_id: channel,
                },
                myMembers: {channelid1: {channel_id: 'channelid1', user_id: 'current_user_id'}},
            },
            teams: {
                currentTeamId: currentTeam.id,
                teams: {
                    current_team_id: currentTeam,
                    team_id_1: team,
                },
            },
            posts: {
                dm_post_id: dmPost,
                gm_post_id: gmPost,
                post_id: post,
                dm_reply_id: dmReply,
                gm_reply_id: gmReply,
                reply_id: reply,
            },
        },
    } as unknown as GlobalState);

    test.each([
        ['/current_team_name/messages/@jessicahyde/dm_post_id', dmPost, true],
        ['/current_team_name/messages/gm_channel_name/gm_post_id', gmPost, true],
        ['/team_1/channels/channel_name/post_id', post, true],

        ['/current_team_name/messages/@jessicahyde/dm_post_id', dmPost, false],
        ['/current_team_name/messages/gm_channel_name/gm_post_id', gmPost, false],
        ['/team_1/channels/channel_name/post_id', post, false],
    ])('root posts should return %s', (expected, postCase, collapsedThreads) => {
        const state = getState(collapsedThreads);
        expect(PostUtils.getPostURL(state, postCase)).toBe(expected);
    });

    test.each([
        ['/current_team_name/messages/@jessicahyde', dmReply, true],
        ['/current_team_name/messages/gm_channel_name', gmReply, true],
        ['/team_1/channels/channel_name', reply, true],

        ['/current_team_name/messages/@jessicahyde/dm_reply_id', dmReply, false],
        ['/current_team_name/messages/gm_channel_name/gm_reply_id', gmReply, false],
        ['/team_1/channels/channel_name/reply_id', reply, false],
    ])('replies should return %s', (expected, postCase, collapsedThreads) => {
        const state = getState(collapsedThreads);
        expect(PostUtils.getPostURL(state, postCase)).toBe(expected);
    });
});
