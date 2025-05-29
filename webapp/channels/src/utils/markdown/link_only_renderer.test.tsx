// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {formatWithRenderer} from 'utils/markdown';
import LinkOnlyRenderer from 'utils/markdown/link_only_renderer';

describe('formatWithRenderer | LinkOnlyRenderer', () => {
    const testCases = [
        {
            description: 'emoji: same',
            inputText: 'Hey :smile: :+1: :)',
            outputText: 'Hey :smile: :+1: :)',
        },
        {
            description: 'at-mention: same',
            inputText: 'Hey @user and @test',
            outputText: 'Hey @user and @test',
        },
        {
            description: 'channel-link: same',
            inputText: 'join ~channelname',
            outputText: 'join ~channelname',
        },
        {
            description: 'codespan: single backtick',
            inputText: '`single backtick`',
            outputText: 'single backtick',
        },
        {
            description: 'codespan: double backtick',
            inputText: '``double backtick``',
            outputText: 'double backtick',
        },
        {
            description: 'codespan: triple backtick',
            inputText: '```triple backtick```',
            outputText: 'triple backtick',
        },
        {
            description: 'codespan: inline code',
            inputText: 'Inline `code` has ``double backtick`` and ```triple backtick``` around it.',
            outputText: 'Inline code has double backtick and triple backtick around it.',
        },
        {
            description: 'code block: single line code block',
            inputText: 'Code block\n```\nline\n```',
            outputText: 'Code block line',
        },
        {
            description: 'code block: multiline code block 2',
            inputText: 'Multiline\n```function(number) {\n  return number + 1;\n}```',
            outputText: 'Multiline function(number) {   return number + 1; }',
        },
        {
            description: 'code block: language highlighting',
            inputText: '```javascript\nvar s = "JavaScript syntax highlighting";\nalert(s);\n```',
            outputText: 'var s = &quot;JavaScript syntax highlighting&quot;; alert(s);',
        },
        {
            description: 'blockquote:',
            inputText: '> Hey quote',
            outputText: 'Hey quote',
        },
        {
            description: 'blockquote: multiline',
            inputText: '> Hey quote.\n> Hello quote.',
            outputText: 'Hey quote. Hello quote.',
        },
        {
            description: 'heading: # H1 header',
            inputText: '# H1 header',
            outputText: 'H1 header',
        },
        {
            description: 'heading: heading with @user',
            inputText: '# H1 @user',
            outputText: 'H1 @user',
        },
        {
            description: 'heading: ## H2 header',
            inputText: '## H2 header',
            outputText: 'H2 header',
        },
        {
            description: 'heading: ### H3 header',
            inputText: '### H3 header',
            outputText: 'H3 header',
        },
        {
            description: 'heading: #### H4 header',
            inputText: '#### H4 header',
            outputText: 'H4 header',
        },
        {
            description: 'heading: ##### H5 header',
            inputText: '##### H5 header',
            outputText: 'H5 header',
        },
        {
            description: 'heading: ###### H6 header',
            inputText: '###### H6 header',
            outputText: 'H6 header',
        },
        {
            description: 'heading: multiline with header and paragraph',
            inputText: '###### H6 header\nThis is next line.\nAnother line.',
            outputText: 'H6 header This is next line. Another line.',
        },
        {
            description: 'heading: multiline with header and list items',
            inputText: '###### H6 header\n- list item 1\n- list item 2',
            outputText: 'H6 header list item 1 list item 2',
        },
        {
            description: 'heading: multiline with header and links',
            inputText: '###### H6 header\n[link 1](https://mattermost.com) - [link 2](https://mattermost.com)',
            outputText: 'H6 header <a class="theme markdown__link" href="https://mattermost.com" target="_blank">' +
            'link 1</a> - <a class="theme markdown__link" href="https://mattermost.com" target="_blank">link 2</a>',
        },
        {
            description: 'list: 1. First ordered list item',
            inputText: '1. First ordered list item',
            outputText: 'First ordered list item',
        },
        {
            description: 'list: 2. Another item',
            inputText: '1. 2. Another item',
            outputText: 'Another item',
        },
        {
            description: 'list: * Unordered sub-list.',
            inputText: '* Unordered sub-list.',
            outputText: 'Unordered sub-list.',
        },
        {
            description: 'list: - Or minuses',
            inputText: '- Or minuses',
            outputText: 'Or minuses',
        },
        {
            description: 'list: + Or pluses',
            inputText: '+ Or pluses',
            outputText: 'Or pluses',
        },
        {
            description: 'list: multiline',
            inputText: '1. First ordered list item\n2. Another item',
            outputText: 'First ordered list item Another item',
        },
        {
            description: 'tablerow:)',
            inputText: 'Markdown | Less | Pretty\n' +
            '--- | --- | ---\n' +
            '*Still* | `renders` | **nicely**\n' +
            '1 | 2 | 3\n',
            outputText: '',
        },
        {
            description: 'table:',
            inputText: '| Tables        | Are           | Cool  |\n' +
            '| ------------- |:-------------:| -----:|\n' +
            '| col 3 is      | right-aligned | $1600 |\n' +
            '| col 2 is      | centered      |   $12 |\n' +
            '| zebra stripes | are neat      |    $1 |\n',
            outputText: '',
        },
        {
            description: 'strong: Bold with **asterisks** or __underscores__.',
            inputText: 'Bold with **asterisks** or __underscores__.',
            outputText: 'Bold with asterisks or underscores.',
        },
        {
            description: 'strong & em: Bold and italics with **asterisks and _underscores_**.',
            inputText: 'Bold and italics with **asterisks and _underscores_**.',
            outputText: 'Bold and italics with asterisks and underscores.',
        },
        {
            description: 'em: Italics with *asterisks* or _underscores_.',
            inputText: 'Italics with *asterisks* or _underscores_.',
            outputText: 'Italics with asterisks or underscores.',
        },
        {
            description: 'del: Strikethrough ~~strike this.~~',
            inputText: 'Strikethrough ~~strike this.~~',
            outputText: 'Strikethrough strike this.',
        },
        {
            description: 'links: [inline-style link](http://localhost:8065)',
            inputText: '[inline-style link](http://localhost:8065)',
            outputText: '<a class="theme markdown__link" href="http://localhost:8065" target="_blank">' +
            'inline-style link</a>',
        },
        {
            description: 'image: ![image link](http://localhost:8065/image)',
            inputText: '![image link](http://localhost:8065/image)',
            outputText: 'image link',
        },
        {
            description: 'text: plain',
            inputText: 'This is plain text.',
            outputText: 'This is plain text.',
        },
        {
            description: 'text: multiline',
            inputText: 'This is multiline text.\nHere is the next line.\n',
            outputText: 'This is multiline text. Here is the next line.',
        },
        {
            description: 'text: &amp; entity',
            inputText: 'you & me',
            outputText: 'you &amp; me',
        },
        {
            description: 'text: &lt; entity',
            inputText: '1<2',
            outputText: '1&lt;2',
        },
        {
            description: 'text: &gt; entity',
            inputText: '2>1',
            outputText: '2&gt;1',
        },
        {
            description: 'text: &#39; entity',
            inputText: 'he\'s out',
            outputText: 'he&#39;s out',
        },
        {
            description: 'text: &quot; entity',
            inputText: 'That is "unique"',
            outputText: 'That is &quot;unique&quot;',
        },
        {
            description: 'text: multiple entities',
            inputText: '&<>\'"',
            outputText: '&amp;&lt;&gt;&#39;&quot;',
        },
        {
            description: 'text: multiple entities',
            inputText: '"\'><&',
            outputText: '&quot;&#39;&gt;&lt;&amp;',
        },
        {
            description: 'text: multiple entities',
            inputText: '&amp;&lt;&gt;&#39;&quot;',
            outputText: '&amp;&lt;&gt;&#39;&quot;',
        },
        {
            description: 'text: multiple entities',
            inputText: '&quot;&#39;&gt;&lt;&amp;',
            outputText: '&quot;&#39;&gt;&lt;&amp;',
        },
        {
            description: 'text: multiple entities',
            inputText: '&amp;lt;',
            outputText: '&amp;lt;',
        },
        {
            description: 'text: empty string',
            inputText: '',
            outputText: '',
        },
        {
            description: 'link: link without a scheme',
            inputText: 'Do you like www.mattermost.com?',
            outputText: 'Do you like <a class="theme markdown__link" href="http://www.mattermost.com" target="_blank">' +
            'www.mattermost.com</a>?',
        },
        {
            description: 'link: link with a scheme',
            inputText: 'Do you like http://www.mattermost.com?',
            outputText: 'Do you like <a class="theme markdown__link" href="http://www.mattermost.com" target="_blank">' +
            'http://www.mattermost.com</a>?',
        },
        {
            description: 'link: link with a title',
            inputText: 'Do you like [Mattermost](http://www.mattermost.com)?',
            outputText: 'Do you like <a class="theme markdown__link" href="http://www.mattermost.com" target="_blank">' +
            'Mattermost</a>?',
        },
        {
            description: 'link: link with curly brackets',
            inputText: 'Let\'s try http://example/result?things={stuff}',
            outputText: 'Let&#39;s try <a class="theme markdown__link" href="http://example/result?things={stuff}" target="_blank">http://example/result?things={stuff}</a>',
        },
        {
            description: 'link: link with a full-length punctuation',
            inputText: 'Do you like https://mattermost.com/，這是第二個網址。?',
            outputText: 'Do you like <a class="theme markdown__link" href="https://mattermost.com/" target="_blank">' +
                'https://mattermost.com/</a>，這是第二個網址。?',
        },
    ];

    const linkOnlyRenderer = new LinkOnlyRenderer();

    testCases.forEach((testCase) => it(testCase.description, () => {
        expect(formatWithRenderer(testCase.inputText, linkOnlyRenderer)).toEqual(testCase.outputText);
    }));
});
