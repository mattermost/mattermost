// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Markdown from 'components/markdown';

import {renderWithContext} from 'tests/react_testing_utils';

import {Locations} from './constants';
import {execCommandInsertText} from './exec_commands';
import {
    parseHtmlTable,
    getHtmlTable,
    formatMarkdownMessage,
    formatGithubCodePaste,
    formatMarkdownLinkMessage,
    hasMarkdownFormatting,
    isTextUrl,
    hasPlainText,
    createFileFromClipboardDataItem,
    pasteHandler, isKnownTargetForPaste,
} from './paste';
import {TestHelper} from './test_helper';

const validClipboardData: any = {
    items: [1],
    types: ['text/html'],
    getData: () => {
        return '<table><tr><td>test</td><td>test</td></tr><tr><td>test</td><td>test</td></tr></table>';
    },
};

const validTable: any = parseHtmlTable(validClipboardData.getData());

describe('getHtmlTable', () => {
    test('returns false without html in the clipboard', () => {
        const badClipboardData: any = {
            items: [1],
            types: ['text/plain'],
        };

        expect(getHtmlTable(badClipboardData)).toBe(null);
    });

    test('returns false without table in the clipboard', () => {
        const badClipboardData: any = {
            items: [1],
            types: ['text/html'],
            getData: () => '<p>There is no table here</p>',
        };

        expect(getHtmlTable(badClipboardData)).toBe(null);
    });

    test('returns table from valid clipboard data', () => {
        expect(getHtmlTable(validClipboardData)).toEqual(validTable);
    });
});

describe('formatMarkdownMessage', () => {
    const markdownTable = '| test | test |\n| --- | --- |\n| test | test |';

    test('returns a markdown table when valid html table provided', () => {
        expect(formatMarkdownMessage(validClipboardData).formattedMessage).toBe(`${markdownTable}\n`);
    });

    test('returns a markdown table when valid html table with headers provided', () => {
        const tableHeadersClipboardData: any = {
            items: [1],
            types: ['text/html'],
            getData: () => {
                return '<table><tr><th>test</th><th>test</th></tr><tr><td>test</td><td>test</td></tr></table>';
            },
        };

        expect(formatMarkdownMessage(tableHeadersClipboardData).formattedMessage).toBe(markdownTable);
    });

    test('removes style contents and additional whitespace around tables', () => {
        const styleClipboardData: any = {
            items: [1],
            types: ['text/html'],
            getData: () => {
                return '<style><!--td {border: 1px solid #cccccc;}--></style>\n<table><tr><th>test</th><th>test</th></tr><tr><td>test</td><td>test</td></tr></table>\n';
            },
        };

        expect(formatMarkdownMessage(styleClipboardData).formattedMessage).toBe(markdownTable);
    });

    test('returns a markdown table under a message when one is provided', () => {
        const testMessage = 'test message';

        expect(formatMarkdownMessage(validClipboardData, testMessage).formattedMessage).toBe(`${testMessage}\n\n${markdownTable}\n`);
    });

    test('returns a markdown formatted link when valid hyperlink provided', () => {
        const linkClipboardData: any = {
            items: [1],
            types: ['text/html'],
            getData: () => {
                return '<a href="https://test.domain">link text</a>';
            },
        };
        const markdownLink = '[link text](https://test.domain)';

        expect(formatMarkdownMessage(linkClipboardData).formattedMessage).toBe(markdownLink);
    });
});

describe('formatGithubCodePaste', () => {
    const clipboardData: any = {
        items: [],
        types: ['text/plain', 'text/html'],
        getData: (type: any) => {
            if (type === 'text/plain') {
                return '// a javascript codeblock example\nif (1 > 0) {\n  return \'condition is true\';\n}';
            }
            return '<table class="highlight tab-size js-file-line-container" data-tab-size="8"><tbody><tr><td id="LC1" class="blob-code blob-code-inner js-file-line"><span class="pl-c"><span class="pl-c">//</span> a javascript codeblock example</span></td></tr><tr><td id="L2" class="blob-num js-line-number" data-line-number="2">&nbsp;</td><td id="LC2" class="blob-code blob-code-inner js-file-line"><span class="pl-k">if</span> (<span class="pl-c1">1</span> <span class="pl-k">&gt;</span> <span class="pl-c1">0</span>) {</td></tr><tr><td id="L3" class="blob-num js-line-number" data-line-number="3">&nbsp;</td><td id="LC3" class="blob-code blob-code-inner js-file-line"><span class="pl-en">console</span>.<span class="pl-c1">log</span>(<span class="pl-s"><span class="pl-pds">\'</span>condition is true<span class="pl-pds">\'</span></span>);</td></tr><tr><td id="L4" class="blob-num js-line-number" data-line-number="4">&nbsp;</td><td id="LC4" class="blob-code blob-code-inner js-file-line">}</td></tr></tbody></table>';
        },
    };

    test('Formatted message for empty message', () => {
        const message = "```\n// a javascript codeblock example\nif (1 > 0) {\n  return 'condition is true';\n}\n```";
        const codeBlock = "```\n// a javascript codeblock example\nif (1 > 0) {\n  return 'condition is true';\n}\n```";

        const {formattedMessage, formattedCodeBlock} = formatGithubCodePaste({selectionStart: 0, selectionEnd: 0, message: '', clipboardData});
        expect(message).toBe(formattedMessage);
        expect(codeBlock).toBe(formattedCodeBlock);
    });

    test('Formatted message with a draft and cursor at end', () => {
        const message = "test\n```\n// a javascript codeblock example\nif (1 > 0) {\n  return 'condition is true';\n}\n```";
        const codeBlock = "\n```\n// a javascript codeblock example\nif (1 > 0) {\n  return 'condition is true';\n}\n```";

        const {formattedMessage, formattedCodeBlock} = formatGithubCodePaste({selectionStart: 4, selectionEnd: 4, message: 'test', clipboardData});
        expect(message).toBe(formattedMessage);
        expect(codeBlock).toBe(formattedCodeBlock);
    });

    test('Formatted message with a draft and cursor at start', () => {
        const message = "```\n// a javascript codeblock example\nif (1 > 0) {\n  return 'condition is true';\n}\n```\ntest";
        const codeBlock = "```\n// a javascript codeblock example\nif (1 > 0) {\n  return 'condition is true';\n}\n```\n";

        const {formattedMessage, formattedCodeBlock} = formatGithubCodePaste({selectionStart: 0, selectionEnd: 0, message: 'test', clipboardData});
        expect(message).toBe(formattedMessage);
        expect(codeBlock).toBe(formattedCodeBlock);
    });

    test('Formatted message with a draft and cursor at middle', () => {
        const message = "te\n```\n// a javascript codeblock example\nif (1 > 0) {\n  return 'condition is true';\n}\n```\nst";
        const codeBlock = "\n```\n// a javascript codeblock example\nif (1 > 0) {\n  return 'condition is true';\n}\n```\n";

        const {formattedMessage, formattedCodeBlock} = formatGithubCodePaste({selectionStart: 2, selectionEnd: 2, message: 'test', clipboardData});
        expect(message).toBe(formattedMessage);
        expect(codeBlock).toBe(formattedCodeBlock);
    });

    test('Selected message in the middle is replaced with code', () => {
        const originalMessage = 'test replace message';
        const codeBlock = "\n```\n// a javascript codeblock example\nif (1 > 0) {\n  return 'condition is true';\n}\n```\n";
        const updatedMessage = "test \n```\n// a javascript codeblock example\nif (1 > 0) {\n  return 'condition is true';\n}\n```\n message";

        const {formattedMessage, formattedCodeBlock} = formatGithubCodePaste({selectionStart: 5, selectionEnd: 12, message: originalMessage, clipboardData});
        expect(updatedMessage).toBe(formattedMessage);
        expect(codeBlock).toBe(formattedCodeBlock);
    });
});

describe('formatMarkdownLinkMessage', () => {
    const clipboardData: any = {
        items: [],
        types: ['text/plain'],
        getData: () => {
            return 'https://example.com/';
        },
    };

    test('Should return empty selection when no selection is made', () => {
        const message = '';

        const formatttedMarkdownLinkMessage = formatMarkdownLinkMessage({selectionStart: 0, selectionEnd: 0, message, clipboardData});
        expect(formatttedMarkdownLinkMessage).toEqual('[](https://example.com/)');
    });

    test('Should return correct selection when selection is made', () => {
        const message = 'test';

        const formatttedMarkdownLinkMessage = formatMarkdownLinkMessage({selectionStart: 0, selectionEnd: 4, message, clipboardData});
        expect(formatttedMarkdownLinkMessage).toEqual('[test](https://example.com/)');
    });

    test('Should not add link when pasting inside of a formatted markdown link', () => {
        const message = '[test](url)';
        const formatttedMarkdownLinkMessage = formatMarkdownLinkMessage({selectionStart: 7, selectionEnd: 10, message, clipboardData});
        expect(formatttedMarkdownLinkMessage).toEqual('https://example.com/');
    });

    test('Should add link when pasting inside of an improper formatted markdown link', () => {
        const improperFormattedLinkMessages = [
            {message: '[test](url)', selection: 'ur', expected: '[ur](https://example.com/)'},
            {message: '[test](url)', selection: '(url', expected: '[(url](https://example.com/)'},
            {message: '[test](url)', selection: 'url)', expected: '[url)](https://example.com/)'},
            {message: '[test](url)', selection: '(url)', expected: '[(url)](https://example.com/)'},
            {message: '[test](url)', selection: '[test](url', expected: '[[test](url](https://example.com/)'},
            {message: '[test](url)', selection: 'test](url', expected: '[test](url](https://example.com/)'},
            {message: '[test](url)', selection: 'test](url)', expected: '[test](url)](https://example.com/)'},
            {message: '[test](url)', selection: '[test](url)', expected: '[[test](url)](https://example.com/)'},
        ];

        for (const {message, selection, expected} of improperFormattedLinkMessages) {
            const selectionStart = message.indexOf(selection);
            const selectionEnd = selectionStart + selection.length;

            const formatttedMarkdownLinkMessage = formatMarkdownLinkMessage({selectionStart, selectionEnd, message, clipboardData});
            expect(formatttedMarkdownLinkMessage).toEqual(expected);
        }
    });
});

describe('isTextUrl', () => {
    test('Should return true when url is valid', () => {
        const clipboardData: any = {
            ...validClipboardData,
            getData: () => {
                return 'https://example.com/';
            },
        };
        expect(isTextUrl(clipboardData)).toBe(true);
    });

    test('Should return false when url is invalid', () => {
        const clipboardData: any = {
            ...validClipboardData,
            getData: () => {
                return 'not a url';
            },
        };

        expect(isTextUrl(clipboardData)).toBe(false);
    });
});

describe('hasMarkdownFormatting', () => {
    const clipboardDataWith = (html: string): any => ({
        items: [1],
        types: ['text/html'],
        getData: () => html,
    });

    test('Should return false without html in the clipboard', () => {
        expect(hasMarkdownFormatting({items: [1], types: ['text/plain']} as any)).toBe(false);
    });

    test('Should return false for html without anything to format', () => {
        expect(hasMarkdownFormatting(clipboardDataWith('<span style="color: red">a * b</span>'))).toBe(false);
        expect(hasMarkdownFormatting(clipboardDataWith('<p>a paragraph</p><div>a division</div>'))).toBe(false);
    });

    test('Should return true for html with formatting', () => {
        expect(hasMarkdownFormatting(clipboardDataWith('<h1>heading</h1>'))).toBe(true);
        expect(hasMarkdownFormatting(clipboardDataWith('<p>a <strong>bold</strong> word</p>'))).toBe(true);
        expect(hasMarkdownFormatting(clipboardDataWith('<p>a <b>bold</b> word</p>'))).toBe(true);
        expect(hasMarkdownFormatting(clipboardDataWith('<p>a <i>italic</i> word</p>'))).toBe(true);
        expect(hasMarkdownFormatting(clipboardDataWith('<p>a <del>struck</del> word</p>'))).toBe(true);
        expect(hasMarkdownFormatting(clipboardDataWith('<p>a <code>coded</code> word</p>'))).toBe(true);
        expect(hasMarkdownFormatting(clipboardDataWith('<ul><li>a bullet</li></ul>'))).toBe(true);
        expect(hasMarkdownFormatting(clipboardDataWith('<ol><li>a step</li></ol>'))).toBe(true);
        expect(hasMarkdownFormatting(clipboardDataWith('<blockquote>a quote</blockquote>'))).toBe(true);
        expect(hasMarkdownFormatting(clipboardDataWith('<pre>some code</pre>'))).toBe(true);
        expect(hasMarkdownFormatting(clipboardDataWith('<table><tr><td>a cell</td></tr></table>'))).toBe(true);
        expect(hasMarkdownFormatting(clipboardDataWith('<p>above</p><hr><p>below</p>'))).toBe(true);
    });

    test('Should ignore emphasis that is styled away, as used by Google Docs', () => {
        expect(hasMarkdownFormatting(clipboardDataWith('<b style="font-weight:normal"><span>plain text</span></b>'))).toBe(false);
        expect(hasMarkdownFormatting(clipboardDataWith('<b style="font-weight:400"><span>plain text</span></b>'))).toBe(false);
        expect(hasMarkdownFormatting(clipboardDataWith('<strong style="font-weight:normal">plain text</strong>'))).toBe(false);
        expect(hasMarkdownFormatting(clipboardDataWith('<i style="font-style:normal"><span>plain text</span></i>'))).toBe(false);
        expect(hasMarkdownFormatting(clipboardDataWith('<em style="font-style:normal">plain text</em>'))).toBe(false);
        expect(hasMarkdownFormatting(clipboardDataWith('<b style="font-weight:normal"><em>emphasized</em></b>'))).toBe(true);
    });
});

jest.mock('utils/exec_commands', () => ({
    execCommandInsertText: jest.fn(),
}));

describe('pasteHandler', () => {
    const testCases = [
        {
            testName: 'should be able to format a pasted markdown table',
            clipboardData: {
                items: [1],
                types: ['text/html'],
                getData: () => {
                    return '<table><tr><th>test</th><th>test</th></tr><tr><td>test</td><td>test</td></tr></table>';
                },
            },
            expectedMarkdown: '| test | test |\n| --- | --- |\n| test | test |',
        },
        {
            testName: 'should be able to format a pasted markdown table without headers',
            clipboardData: {
                items: [1],
                types: ['text/html'],
                getData: () => {
                    return '<table><tr><td>test</td><td>test</td></tr><tr><td>test</td><td>test</td></tr></table>';
                },
            },
            expectedMarkdown: '| test | test |\n| --- | --- |\n| test | test |\n',
        },
        {
            testName: 'should be able to format a pasted hyperlink',
            clipboardData: {
                items: [1],
                types: ['text/html'],
                getData: () => {
                    return '<a href="https://test.domain">link text</a>';
                },
            },
            expectedMarkdown: '[link text](https://test.domain)',
        },
        {
            testName: 'should be able to format a github codeblock (pasted as a table)',
            clipboardData: {
                items: [1],
                types: ['text/plain', 'text/html'],
                getData: (type: string) => {
                    if (type === 'text/plain') {
                        return '// a javascript codeblock example\nif (1 > 0) {\n  return \'condition is true\';\n}';
                    }
                    return '<table class="highlight tab-size js-file-line-container" data-tab-size="8"><tbody><tr><td id="LC1" class="blob-code blob-code-inner js-file-line"><span class="pl-c"><span class="pl-c">//</span> a javascript codeblock example</span></td></tr><tr><td id="L2" class="blob-num js-line-number" data-line-number="2">&nbsp;</td><td id="LC2" class="blob-code blob-code-inner js-file-line"><span class="pl-k">if</span> (<span class="pl-c1">1</span> <span class="pl-k">&gt;</span> <span class="pl-c1">0</span>) {</td></tr><tr><td id="L3" class="blob-num js-line-number" data-line-number="3">&nbsp;</td><td id="LC3" class="blob-code blob-code-inner js-file-line"><span class="pl-en">console</span>.<span class="pl-c1">log</span>(<span class="pl-s"><span class="pl-pds">\'</span>condition is true<span class="pl-pds">\'</span></span>);</td></tr><tr><td id="L4" class="blob-num js-line-number" data-line-number="4">&nbsp;</td><td id="LC4" class="blob-code blob-code-inner js-file-line">}</td></tr></tbody></table>';
                },
            },
            expectedMarkdown: "```\n// a javascript codeblock example\nif (1 > 0) {\n  return 'condition is true';\n}\n```",
        },
        {
            testName: 'should paste table as plain text when shift is held',
            isNonFormattedPaste: true,
            clipboardData: {
                items: [1],
                types: ['text/plain', 'text/html'],
                getData: (dataType: string) => {
                    if (dataType === 'text/plain') {
                        return 'test \ttest\ntest \ttest';
                    }
                    return '<table><tr><th>test</th>\n<th>test</th>\n</tr>\n<tr>\n<td>test</td>\n<td>test</td></tr></table>';
                },
            },
            expectedMarkdown: 'test \ttest\ntest \ttest',
        },
        {
            testName: 'should paste github code as plain text when shift is held',
            isNonFormattedPaste: true,
            clipboardData: {
                items: [1],
                types: ['text/plain', 'text/html'],
                getData: (type: string) => {
                    if (type === 'text/plain') {
                        return '// a javascript codeblock example\nif (1 > 0) {\n  return \'condition is true\';\n}';
                    }
                    return '<table class="highlight tab-size js-file-line-container" data-tab-size="8"><tbody><tr><td id="LC1" class="blob-code blob-code-inner js-file-line"><span class="pl-c"><span class="pl-c">//</span> a javascript codeblock example</span></td></tr><tr><td id="L2" class="blob-num js-line-number" data-line-number="2">&nbsp;</td><td id="LC2" class="blob-code blob-code-inner js-file-line"><span class="pl-k">if</span> (<span class="pl-c1">1</span> <span class="pl-k">&gt;</span> <span class="pl-c1">0</span>) {</td></tr><tr><td id="L3" class="blob-num js-line-number" data-line-number="3">&nbsp;</td><td id="LC3" class="blob-code blob-code-inner js-file-line"><span class="pl-en">console</span>.<span class="pl-c1">log</span>(<span class="pl-s"><span class="pl-pds">\'</span>condition is true<span class="pl-pds">\'</span></span>);</td></tr><tr><td id="L4" class="blob-num js-line-number" data-line-number="4">&nbsp;</td><td id="LC4" class="blob-code blob-code-inner js-file-line">}</td></tr></tbody></table>';
                },
            },
            expectedMarkdown: '// a javascript codeblock example\nif (1 > 0) {\n  return \'condition is true\';\n}',
        },
    ];

    for (const tc of testCases) {
        it(tc.testName, () => {
            const location = Locations.RHS_COMMENT;
            const event: any = {
                target: {
                    id: 'reply_textbox',
                },
                preventDefault: jest.fn(),
                clipboardData: tc.clipboardData,
            };

            pasteHandler(event, location, '', tc.isNonFormattedPaste ?? false);

            if (tc.isNonFormattedPaste) {
                expect(execCommandInsertText).not.toHaveBeenCalled();
            } else {
                expect(execCommandInsertText).toHaveBeenCalledWith(tc.expectedMarkdown);
            }
        });
    }
});

describe('pasteHandler with formatted html', () => {
    function pasteHtml(html: string, plainText = '') {
        const event: any = {
            target: {id: 'post_textbox'},
            preventDefault: jest.fn(),
            clipboardData: {
                items: [1],
                types: ['text/html', 'text/plain'],
                getData: (type: string) => (type === 'text/plain' ? plainText : html),
            },
        };

        pasteHandler(event, Locations.CENTER, '', false);

        return event;
    }

    test('should leave html without any formatting to the browser', () => {
        const event = pasteHtml('<span style="color: red">a * b</span>', 'a * b');

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(execCommandInsertText).not.toHaveBeenCalled();
    });

    test('should not emphasize content that Google Docs styles back to normal', () => {
        pasteHtml('<b style="font-weight:normal" id="docs-internal-guid-1"><p>plain <em>emphasized</em> text</p></b>', 'plain emphasized text');

        expect(execCommandInsertText).toHaveBeenCalledWith('plain *emphasized* text');
    });

    test.each(['del', 's', 'strike'])('should format %s with the double tilde that Mattermost renders', (tagName) => {
        pasteHtml(`<p>a <${tagName}>struck</${tagName}> word</p>`, 'a struck word');

        expect(execCommandInsertText).toHaveBeenCalledWith('a ~~struck~~ word');
    });

    test('should format a preformatted code block as a fenced code block', () => {
        pasteHtml('<pre><code class="language-js">const a = 1;\nconsole.log(a);</code></pre>', 'const a = 1;\nconsole.log(a);');

        expect(execCommandInsertText).toHaveBeenCalledWith('```js\nconst a = 1;\nconsole.log(a);\n```');
    });

    test('should format a task list', () => {
        pasteHtml('<ul><li><input type="checkbox" checked>done</li><li><input type="checkbox">todo</li></ul>', 'done\ntodo');

        expect(execCommandInsertText).toHaveBeenCalledWith('-   [x] done\n-   [ ] todo');
    });
});

describe('pasteHandler with a message copied out of the channel', () => {
    const townSquare = TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id', name: 'town-square', display_name: 'Town Square'});

    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team_id',
                teams: {team_id: TestHelper.getTeamMock({id: 'team_id', name: 'myteam'})},
            },
            channels: {
                channels: {channel_id: townSquare},
                channelsInTeam: {team_id: new Set(['channel_id'])},
            },
        },
    };

    // Pastes the html that a rendered post is made of, as a browser does when a message is copied out of the channel.
    function pasteRenderedMessage(message: string) {
        const {container} = renderWithContext(<Markdown message={message}/>, initialState);

        // Browsers put the copied markup on the clipboard inside a fragment of a full document.
        const html = `<html><body><!--StartFragment-->${container.innerHTML}<!--EndFragment--></body></html>`;

        const event: any = {
            target: {id: 'post_textbox'},
            preventDefault: jest.fn(),
            clipboardData: {
                items: [1],
                types: ['text/html', 'text/plain'],
                getData: (type: string) => (type === 'text/plain' ? container.textContent : html),
            },
        };

        pasteHandler(event, Locations.CENTER, '', false);
    }

    const testCases = [
        {
            testName: 'headings',
            message: '## A heading',
            expectedMarkdown: '## A heading',
        },
        {
            testName: 'inline formatting',
            message: 'Some **bold** and *italic* and ~~struck~~ and `code`',
            expectedMarkdown: 'Some **bold** and *italic* and ~~struck~~ and `code`',
        },
        {
            testName: 'bulleted lists',
            message: '- one\n- two\n  - nested',
            expectedMarkdown: '-   one\n-   two\n    -   nested',
        },
        {
            testName: 'numbered lists',
            message: '1. one\n2. two',
            expectedMarkdown: '1.  one\n2.  two',
        },
        {
            testName: 'block quotes',
            message: '> a quote',
            expectedMarkdown: '> a quote',
        },
        {
            testName: 'code blocks',
            message: '```javascript\nconst a = 1;\nconsole.log(a);\n```',
            expectedMarkdown: '```javascript\nconst a = 1;\nconsole.log(a);\n```',
        },
        {
            testName: 'code blocks without a language',
            message: '```\nconst a = 1;\nconsole.log(a);\n```',
            expectedMarkdown: '```\nconst a = 1;\nconsole.log(a);\n```',
        },
        {
            testName: 'task lists',
            message: '- [x] done\n- [ ] todo',
            expectedMarkdown: '-   [x]  done\n-   [ ]  todo',
        },
        {
            testName: 'tables',
            message: '| a | b |\n| --- | --- |\n| 1 | 2 |',
            expectedMarkdown: '| a | b |\n| --- | --- |\n| 1 | 2 |',
        },
        {
            testName: 'links',
            message: 'Go to [Mattermost](https://mattermost.com)',
            expectedMarkdown: 'Go to [Mattermost](https://mattermost.com)',
        },
    ];

    for (const tc of testCases) {
        it(`should keep the markdown of ${tc.testName}`, () => {
            pasteRenderedMessage(tc.message);

            expect(execCommandInsertText).toHaveBeenCalledTimes(1);
            expect(execCommandInsertText).toHaveBeenCalledWith(tc.expectedMarkdown);
        });
    }

    it('should keep hashtags out of a link', () => {
        pasteRenderedMessage('A **bold** #hashtag');

        expect(execCommandInsertText).toHaveBeenCalledWith('A **bold** #hashtag');
    });

    it('should keep channel mentions out of a link', () => {
        pasteRenderedMessage('A **bold** ~town-square');

        expect(execCommandInsertText).toHaveBeenCalledWith('A **bold** ~town-square');
    });

    it('should escape markdown characters that are part of the text', () => {
        pasteRenderedMessage('A **bold** thing and 2 * 3 and a_b');

        expect(execCommandInsertText).toHaveBeenCalledWith('A **bold** thing and 2 \\* 3 and a\\_b');
    });

    it('should paste a message without formatting as plain text', () => {
        pasteRenderedMessage('2 * 3 * 4');

        expect(execCommandInsertText).not.toHaveBeenCalled();
    });
});

describe('hasPlainText', () => {
    test('Should return true when clipboard data has plain text', () => {
        const clipboardData = {
            ...validClipboardData,
            types: ['text/plain'],
            getData: () => {
                return 'plain text';
            },
        };

        expect(hasPlainText(clipboardData)).toBe(true);
    });

    test('Should return true when clipboard data has plain text along with other types', () => {
        const clipboardData = {
            ...validClipboardData,
            types: ['text/html', 'text/plain'],
            getData: () => {
                return 'plain text';
            },
        };

        expect(hasPlainText(clipboardData)).toBe(true);
    });

    test('Should return false when clipboard data has empty text', () => {
        const clipboardData = {
            ...validClipboardData,
            types: ['text/html', 'text/plain'],
            getData: () => {
                return '';
            },
        };

        expect(hasPlainText(clipboardData)).toBe(false);
    });

    test('Should return false when clipboard data doesnt not have plain text type', () => {
        const clipboardData = {
            ...validClipboardData,
            types: ['text/html'],
            getData: () => {
                return 'plain text without type';
            },
        };

        expect(hasPlainText(clipboardData)).toBe(false);
    });
});

describe('createFileFromClipboardDataItem', () => {
    test('should return a file from a clipboard item', () => {
        const item = {
            getAsFile: jest.fn(() => ({
                name: 'test1.png',
                type: 'image/png',
            })),
            type: 'image/png',
        } as unknown as DataTransferItem;

        const file = createFileFromClipboardDataItem(item, '') as File;
        expect(file).toBeInstanceOf(File);
        expect(file.name).toEqual('test1.png');
        expect(file.type).toEqual('image/png');
    });

    test('should return null if getAsFile is not a file', () => {
        const item = {
            getAsFile: jest.fn(() => null),
        } as unknown as DataTransferItem;

        const file = createFileFromClipboardDataItem(item, '');
        expect(file).toBeNull();
    });

    test('Should return correct file name when file name is not available', () => {
        const item = {
            getAsFile: jest.fn(() => ({
                type: 'image/jpeg',
            })),
            type: 'image/jpeg',
        } as unknown as DataTransferItem;

        const now = new Date();

        const file = createFileFromClipboardDataItem(item, 'pasted') as File;

        expect(file).toBeInstanceOf(File);
        expect(file.name).toBe(`pasted${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}.jpeg`);
        expect(file.type).toBe('image/jpeg');
    });

    test('Should return correct file extension when file name contains extension', () => {
        const item = {
            getAsFile: jest.fn(() => ({
                name: 'test.jpeg',
            })),
            type: 'image/jpeg',
        } as unknown as DataTransferItem;

        const file = createFileFromClipboardDataItem(item, 'pasted') as File;

        expect(file.name).toContain('.jpeg');
    });

    test('Should return correct file extension when file name doesnt contains extension', () => {
        const item = {
            getAsFile: jest.fn(() => ({
                type: 'image/JPEG',
            })),
            type: 'image/jpeg',
        } as unknown as DataTransferItem;

        const file = createFileFromClipboardDataItem(item, 'pasted') as File;

        expect(file.name).toContain('.jpeg');
    });
});

describe('isKnownTargetForPaste', () => {
    test('editing mode should return true only for edit_textbox', () => {
        expect(isKnownTargetForPaste(
            {target: {id: 'edit_textbox'}} as unknown as ClipboardEvent,
            Locations.RHS_COMMENT,
            true,
        )).toBe(true);

        expect(isKnownTargetForPaste(
            {target: {id: 'edit_textbox'}} as unknown as ClipboardEvent,
            Locations.CENTER,
            true,
        )).toBe(true);

        expect(isKnownTargetForPaste(
            {target: {id: 'post_textbox'}} as unknown as ClipboardEvent,
            Locations.CENTER,
            true,
        )).toBe(false);

        expect(isKnownTargetForPaste(
            {target: {id: 'reply_textbox'}} as unknown as ClipboardEvent,
            Locations.RHS_COMMENT,
            true,
        )).toBe(false);
    });

    test('in non-editing state, center channel can only have post textbox', () => {
        expect(isKnownTargetForPaste(
            {target: {id: 'post_textbox'}} as unknown as ClipboardEvent,
            Locations.CENTER,
            false,
        )).toBe(true);

        expect(isKnownTargetForPaste(
            {target: {id: 'edit_textbox'}} as unknown as ClipboardEvent,
            Locations.CENTER,
            false,
        )).toBe(false);

        expect(isKnownTargetForPaste(
            {target: {id: 'reply_textbox'}} as unknown as ClipboardEvent,
            Locations.CENTER,
            false,
        )).toBe(false);
    });

    test('in non-editing state, RHS can only have reply textbox', () => {
        expect(isKnownTargetForPaste(
            {target: {id: 'reply_textbox'}} as unknown as ClipboardEvent,
            Locations.RHS_COMMENT,
            false,
        )).toBe(true);

        expect(isKnownTargetForPaste(
            {target: {id: 'edit_textbox'}} as unknown as ClipboardEvent,
            Locations.RHS_COMMENT,
            false,
        )).toBe(false);
    });
});
