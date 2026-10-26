// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import turndownService from './turndown';

describe('utils/turndown mattermostCodeBlock', () => {
    test('should convert a highlighted code block to a fenced block', () => {
        const html = '<div class="post-code"><div class="post-code__overlay"><span class="post-code__language">TypeScript</span></div><div class="hljs"><code>const a = 1;</code></div></div>';

        expect(turndownService.turndown(html)).toBe('```typescript\nconst a = 1;\n```');
    });

    test('should use the raw source for a rendered markdown code block', () => {
        const source = '# Title\n\nUse `code` here';
        const html = `<div class="post-code" data-markdown-source="${source.replace(/"/g, '&quot;')}"><div class="post-code__overlay"><span class="post-code__language">Markdown</span></div><div class="post-code__rendered"><h1>Title</h1><p>Use <code>code</code> here</p></div></div>`;

        expect(turndownService.turndown(html)).toBe('```markdown\n# Title\n\nUse `code` here\n```');
    });

    test('should use the raw source for a raw markdown code block, not its line numbers', () => {
        const source = '# Title\n- a\n- b';
        const html = `<div class="post-code post-code--wrap" data-markdown-source="${source}"><div class="post-code__overlay"><span class="post-code__language">Markdown</span></div><div class="hljs"><code class="post-code__wrapped-lines"><span class="post-code__line"><span class="post-code__line-number">1</span><span class="post-code__line-text"># Title</span></span><span class="post-code__line"><span class="post-code__line-number">2</span><span class="post-code__line-text">- a</span></span><span class="post-code__line"><span class="post-code__line-number">3</span><span class="post-code__line-text">- b</span></span></code></div></div>`;

        expect(turndownService.turndown(html)).toBe('```markdown\n' + source + '\n```');
    });

    test('should read the language of the outer code block, not of one rendered inside it', () => {
        const source = '# Title\n\n```typescript\nconst a = 1;\n```';
        const html = `<div class="post-code" data-markdown-source="${source.replace(/"/g, '&quot;')}"><div class="post-code__overlay"></div><div class="post-code__rendered"><h1>Title</h1><div class="post-code"><div class="post-code__overlay"><span class="post-code__language">TypeScript</span></div><div class="hljs"><code>const a = 1;</code></div></div></div></div>`;

        expect(turndownService.turndown(html)).toBe('````\n' + source + '\n````');
    });
});
