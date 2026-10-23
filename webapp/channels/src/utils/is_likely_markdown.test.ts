// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isLikelyMarkdown} from './is_likely_markdown';

describe('utils/isLikelyMarkdown', () => {
    test.each([
        ['heading and bold', '# Title\n\nSome **bold** text'],
        ['deep heading directly above prose', '### This is a header\nThis is not'],
        ['deep heading alone', '## Title'],
        ['deep heading among other lines', 'intro text\n#### Details\nmore text'],
        ['heading and list', '## Steps\n\n- one\n- two'],
        ['list and link', '- see [the docs](https://example.com)\n- and more'],
        ['numbered list and quote', '1. first\n2. second\n\n> note this'],
        ['table and heading', '# Data\n\n| a | b |\n| --- | --- |\n| 1 | 2 |'],
        ['table without outer pipes and bold', 'a | b\n--- | ---\n1 | **2**'],
        ['windows line endings are not required, bold and link', 'Read **this** at [site](http://x.io)'],
    ])('should detect %s', (_name, code) => {
        expect(isLikelyMarkdown(code)).toBe(true);
    });

    test.each([
        ['empty', ''],
        ['plain prose', 'Just a sentence with no formatting at all.'],
        ['shell comment above code', '# install dependencies\nnpm install\n# build\nnpm run build'],
        ['shell comment, blank line, command', '# install\n\nnpm install'],
        ['single-hash line directly above prose', '# Title\nSome plain text'],
        ['shebang and include are not headings', '#!/bin/bash\n#include <stdio.h>'],
        ['python comments', '# compute total\ntotal = sum(xs)\n# done\nprint(total)'],
        ['yaml list only', 'items:\n  - a\n  - b\n  - c'],
        ['single list', '- only item'],
        ['log output with prompts', '> starting\n> running\n> done'],
        ['single link only', 'see [docs](http://x.io)'],
        ['javascript with markdown-ish pieces', 'const a = b ** 2;\nconst c = d ** e;'],
        ['pipes without divider', 'a | b\n1 | 2'],
        ['json', '{\n  "name": "x",\n  "list": [1, 2]\n}'],
    ])('should not detect %s', (_name, code) => {
        expect(isLikelyMarkdown(code)).toBe(false);
    });

    test('should skip very large input', () => {
        const big = '# Title\n\n**bold** '.repeat(10000);

        expect(big.length).toBeGreaterThan(50000);
        expect(isLikelyMarkdown(big)).toBe(false);
    });
});
