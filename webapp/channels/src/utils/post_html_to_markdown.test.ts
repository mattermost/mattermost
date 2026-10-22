// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {postHtmlToMarkdown} from './post_html_to_markdown';

function convert(html: string) {
    const element = document.createElement('div');
    element.innerHTML = html;
    return postHtmlToMarkdown(element);
}

describe('postHtmlToMarkdown', () => {
    test('should convert a rendered post message back to Markdown', () => {
        // Markup rendered by the web app for a post, trimmed for readability
        const html = `
            <h2 class="markdown__heading"><span data-emoticon="rocket"><span class="emoticon" aria-label=":rocket:">🚀</span></span> Project Update</h2>
            <p>We are making progress on the <strong>core infrastructure</strong>, cc <span class="mention--highlight"><span data-mention="alex.morgan"><button class="style--none" type="button"><span class="mention-link">@Alex Morgan</span></button></span></span> in <a class="mention-link" href="/team/channels/town-square" data-channel-mention="town-square">~Town Square</a> <a class="mention-link" href="#" data-hashtag="#release">#release</a> <span data-emoticon="tada"><span class="emoticon">:tada:</span></span></p>
            <h3 class="markdown__heading">Key Objectives</h3>
            <ul class="markdown__list"><li><strong>Performance:</strong> Reduce latency by <em>at least 20%</em>.</li><li>Deploy the new <span class="codespan__pre-wrap"><code>auth</code></span> protocol.</li></ul>
            <div class="post-code" data-language="javascript"><div class="post-code__overlay"><span class="post-code__clipboard" role="button"></span><span class="post-code__language">JavaScript</span></div><div class="hljs"><div class="post-code__line-numbers">1\n2</div><code><span class="hljs-keyword">const</span> client = <span class="hljs-keyword">new</span> Client();\nclient.start();</code></div></div>
            <blockquote><p><strong>Important Note:</strong> Update your environment variables.</p></blockquote>
            <div class="table-responsive"><table class="markdown__table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>a</td><td>1</td></tr></tbody></table></div>
            <p>Check our <a class="theme markdown__link" href="https://example.com">Internal Dashboard</a>. <del>old</del></p>
        `;

        expect(convert(html)).toBe([
            '## 🚀 Project Update',
            '',
            'We are making progress on the **core infrastructure**, cc @alex.morgan in ~town-square #release :tada:',
            '',
            '### Key Objectives',
            '',
            '* **Performance:** Reduce latency by *at least 20%*.',
            '* Deploy the new `auth` protocol.',
            '',
            '```javascript',
            'const client = new Client();',
            'client.start();',
            '```',
            '',
            '> **Important Note:** Update your environment variables.',
            '',
            '| Name | Value |',
            '| --- | --- |',
            '| a | 1 |',
            '',
            'Check our [Internal Dashboard](https://example.com). ~~old~~',
        ].join('\n'));
    });

    test('should convert nested and ordered lists', () => {
        const html = '<ol start="3"><li>Third<ul><li>Nested</li></ul></li><li>Fourth</li></ol>';

        expect(convert(html)).toBe('3. Third\n   * Nested\n4. Fourth');
    });

    test('should keep plain text as is', () => {
        expect(convert('Diam sapien pellentesque')).toBe('Diam sapien pellentesque');
    });

    test('should use a longer fence when the code contains backticks', () => {
        const html = '<div class="post-code"><div class="hljs"><code>use ``` to start a code block</code></div></div>';

        expect(convert(html)).toBe('````\nuse ``` to start a code block\n````');
    });
});
