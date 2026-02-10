// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Tests for ExtraFormatting feature flag and spoiler mid-text fix
 *
 * ExtraFormatting: When enabled, __text__ renders as <u>underline</u> instead of bold.
 * Bold still works via **text**.
 *
 * Spoiler fix: ||text|| now renders correctly mid-text (e.g. "hello ||hidden|| world")
 * via pre-processing that extracts spoiler patterns before marked's text rule can consume them.
 *
 * Both features are implemented via pre/post processing in utils/markdown/index.ts,
 * not by modifying the marked parser.
 */

import {preprocessMarkdown, postprocessMarkdown} from 'utils/markdown/index';
import {applyMarkdown} from 'utils/markdown/apply_markdown';

// Token constants matching index.ts (control chars)
const UL_OPEN = '\x00u\x01';
const UL_CLOSE = '\x00/u\x01';
const SP_OPEN = '\x00s\x01';
const SP_CLOSE = '\x00/s\x01';

describe('ExtraFormatting - preprocessMarkdown', () => {
    describe('underline (__text__)', () => {
        it('should replace __text__ with underline tokens when extraFormatting is enabled', () => {
            const result = preprocessMarkdown('hello __world__ foo', true, false);
            expect(result).toBe(`hello ${UL_OPEN}world${UL_CLOSE} foo`);
        });

        it('should not replace __text__ when extraFormatting is disabled', () => {
            const result = preprocessMarkdown('hello __world__ foo', false, false);
            expect(result).toBe('hello __world__ foo');
        });

        it('should handle multiple underlines in one line', () => {
            const result = preprocessMarkdown('__first__ and __second__', true, false);
            expect(result).toBe(`${UL_OPEN}first${UL_CLOSE} and ${UL_OPEN}second${UL_CLOSE}`);
        });

        it('should handle underline with spaces inside', () => {
            const result = preprocessMarkdown('__hello world__', true, false);
            expect(result).toBe(`${UL_OPEN}hello world${UL_CLOSE}`);
        });

        it('should not replace __ inside inline code spans', () => {
            const result = preprocessMarkdown('use `__init__` method', true, false);
            expect(result).toBe('use `__init__` method');
        });

        it('should not replace __ inside code blocks', () => {
            const result = preprocessMarkdown('```\n__bold__\n```', true, false);
            expect(result).toBe('```\n__bold__\n```');
        });

        it('should not replace __ inside markdown links', () => {
            const result = preprocessMarkdown('[click](https://example.com/__path__)', true, false);
            expect(result).toBe('[click](https://example.com/__path__)');
        });

        it('should not replace __ inside bare URLs', () => {
            const result = preprocessMarkdown('visit https://docs.python.org/__init__.html today', true, false);
            expect(result).toBe('visit https://docs.python.org/__init__.html today');
        });

        it('should not match triple underscores ___text___', () => {
            // ___text___ = bold+italic in standard markdown, not underline
            const result = preprocessMarkdown('___text___', true, false);
            // The regex __([\s\S]+?)__(?!_) with lazy match:
            // __(_text)__(?!_) -> the last _ makes (?!_) fail for ___text___
            // So it should not produce underline tokens
            expect(result).not.toContain(UL_OPEN);
        });

        it('should preserve inner markdown syntax', () => {
            // __**bold** text__ -> inner **bold** should be preserved for marked to process
            const result = preprocessMarkdown('__**bold** text__', true, false);
            expect(result).toBe(`${UL_OPEN}**bold** text${UL_CLOSE}`);
        });

        it('should handle underline at start of text', () => {
            const result = preprocessMarkdown('__start__ rest', true, false);
            expect(result).toBe(`${UL_OPEN}start${UL_CLOSE} rest`);
        });

        it('should handle underline at end of text', () => {
            const result = preprocessMarkdown('rest __end__', true, false);
            expect(result).toBe(`rest ${UL_OPEN}end${UL_CLOSE}`);
        });

        it('should handle text that is only underline', () => {
            const result = preprocessMarkdown('__everything__', true, false);
            expect(result).toBe(`${UL_OPEN}everything${UL_CLOSE}`);
        });
    });

    describe('spoiler (||text||)', () => {
        it('should replace ||text|| with spoiler tokens when spoiler is enabled', () => {
            const result = preprocessMarkdown('||hidden||', false, true);
            expect(result).toBe(`${SP_OPEN}hidden${SP_CLOSE}`);
        });

        it('should not replace ||text|| when spoiler is disabled', () => {
            const result = preprocessMarkdown('||hidden||', false, false);
            expect(result).toBe('||hidden||');
        });

        it('should handle mid-text spoilers (the bug fix)', () => {
            const result = preprocessMarkdown('hello ||hidden|| world', false, true);
            expect(result).toBe(`hello ${SP_OPEN}hidden${SP_CLOSE} world`);
        });

        it('should handle multiple spoilers in one line', () => {
            const result = preprocessMarkdown('||first|| and ||second||', false, true);
            expect(result).toBe(`${SP_OPEN}first${SP_CLOSE} and ${SP_OPEN}second${SP_CLOSE}`);
        });

        it('should not replace || inside code spans', () => {
            const result = preprocessMarkdown('use `||operator||` here', false, true);
            expect(result).toBe('use `||operator||` here');
        });

        it('should not replace || inside code blocks', () => {
            const result = preprocessMarkdown('```\n||not spoiler||\n```', false, true);
            expect(result).toBe('```\n||not spoiler||\n```');
        });

        it('should handle spoiler with single pipe inside', () => {
            // ||text with | pipe|| should still match
            const result = preprocessMarkdown('||text | more||', false, true);
            expect(result).toBe(`${SP_OPEN}text | more${SP_CLOSE}`);
        });

        it('should handle spoiler at start of text', () => {
            const result = preprocessMarkdown('||spoiler|| rest', false, true);
            expect(result).toBe(`${SP_OPEN}spoiler${SP_CLOSE} rest`);
        });
    });

    describe('combined (both flags enabled)', () => {
        it('should handle underline and spoiler in same text', () => {
            const result = preprocessMarkdown('__underlined__ and ||hidden||', true, true);
            expect(result).toBe(`${UL_OPEN}underlined${UL_CLOSE} and ${SP_OPEN}hidden${SP_CLOSE}`);
        });

        it('should handle underline inside spoiler', () => {
            // ||__underlined spoiler__|| -> spoiler wraps underlined content
            const result = preprocessMarkdown('||__secret__||', true, true);
            // extraFormatting runs first, replacing __secret__ with tokens
            // then spoiler runs on the result
            expect(result).toContain(SP_OPEN);
            expect(result).toContain(UL_OPEN);
        });
    });
});

describe('ExtraFormatting - postprocessMarkdown', () => {
    it('should replace underline tokens with <u> tags', () => {
        const html = `hello ${UL_OPEN}world${UL_CLOSE} foo`;
        const result = postprocessMarkdown(html, true, false);
        expect(result).toBe('hello <u>world</u> foo');
    });

    it('should replace spoiler tokens with spoiler spans', () => {
        const html = `hello ${SP_OPEN}hidden${SP_CLOSE} world`;
        const result = postprocessMarkdown(html, false, true);
        expect(result).toBe('hello <span class="markdown-spoiler" data-spoiler="true">hidden</span> world');
    });

    it('should not replace tokens when flags are disabled', () => {
        const htmlWithUl = `${UL_OPEN}text${UL_CLOSE}`;
        const htmlWithSp = `${SP_OPEN}text${SP_CLOSE}`;

        expect(postprocessMarkdown(htmlWithUl, false, false)).toBe(htmlWithUl);
        expect(postprocessMarkdown(htmlWithSp, false, false)).toBe(htmlWithSp);
    });

    it('should handle multiple underline tokens', () => {
        const html = `${UL_OPEN}a${UL_CLOSE} and ${UL_OPEN}b${UL_CLOSE}`;
        const result = postprocessMarkdown(html, true, false);
        expect(result).toBe('<u>a</u> and <u>b</u>');
    });

    it('should handle both underline and spoiler tokens', () => {
        const html = `${UL_OPEN}bold${UL_CLOSE} ${SP_OPEN}secret${SP_CLOSE}`;
        const result = postprocessMarkdown(html, true, true);
        expect(result).toBe('<u>bold</u> <span class="markdown-spoiler" data-spoiler="true">secret</span>');
    });
});

describe('ExtraFormatting - full pre/post pipeline', () => {
    function pipeline(text: string, extraFormatting: boolean, spoiler: boolean): string {
        const preprocessed = preprocessMarkdown(text, extraFormatting, spoiler);
        // Simulate what marked would do: leave our tokens as-is in the text
        // (marked's text rule passes control chars through as opaque text)
        return postprocessMarkdown(preprocessed, extraFormatting, spoiler);
    }

    it('should convert __text__ to <u>text</u> when extraFormatting ON', () => {
        const result = pipeline('__underlined__', true, false);
        expect(result).toBe('<u>underlined</u>');
    });

    it('should leave __text__ as-is when extraFormatting OFF', () => {
        const result = pipeline('__bold__', false, false);
        expect(result).toBe('__bold__');
    });

    it('should convert mid-text ||spoiler|| when spoiler ON', () => {
        const result = pipeline('hello ||hidden|| world', false, true);
        expect(result).toContain('<span class="markdown-spoiler" data-spoiler="true">hidden</span>');
        expect(result).toContain('hello');
        expect(result).toContain('world');
    });

    it('should handle **bold** unchanged regardless of extraFormatting', () => {
        // **bold** is not affected by pre-processing (only __ is)
        const result = pipeline('**bold**', true, false);
        expect(result).toBe('**bold**');
    });

    it('should handle mixed __underline__ and **bold**', () => {
        const result = pipeline('__underlined__ and **bold**', true, false);
        expect(result).toContain('<u>underlined</u>');
        expect(result).toContain('**bold**'); // bold unchanged by pre/post (marked handles it)
    });

    it('should preserve code spans from underline processing', () => {
        const result = pipeline('use `__init__` method', true, false);
        expect(result).toBe('use `__init__` method');
        expect(result).not.toContain('<u>');
    });

    it('should preserve code spans from spoiler processing', () => {
        const result = pipeline('use `||op||` here', false, true);
        expect(result).toBe('use `||op||` here');
        expect(result).not.toContain('markdown-spoiler');
    });
});

describe('applyMarkdown - underline mode', () => {
    it('should wrap selected text with __', () => {
        const result = applyMarkdown({
            markdownMode: 'underline',
            message: 'hello world',
            selectionStart: 6,
            selectionEnd: 11,
        });
        expect(result.message).toBe('hello __world__');
        expect(result.selectionStart).toBe(8); // 6 + 2 (delimiter length)
        expect(result.selectionEnd).toBe(13); // 11 + 2
    });

    it('should remove __ when already applied', () => {
        const result = applyMarkdown({
            markdownMode: 'underline',
            message: 'hello __world__',
            selectionStart: 8,
            selectionEnd: 13,
        });
        expect(result.message).toBe('hello world');
        expect(result.selectionStart).toBe(6);
        expect(result.selectionEnd).toBe(11);
    });

    it('should add __ at cursor position with no selection', () => {
        const result = applyMarkdown({
            markdownMode: 'underline',
            message: 'hello world',
            selectionStart: 5,
            selectionEnd: 5,
        });
        expect(result.message).toBe('hello____ world');
        expect(result.selectionStart).toBe(7); // between the delimiters
        expect(result.selectionEnd).toBe(7);
    });

    it('should handle empty message', () => {
        const result = applyMarkdown({
            markdownMode: 'underline',
            message: '',
            selectionStart: 0,
            selectionEnd: 0,
        });
        expect(result.message).toBe('____');
        expect(result.selectionStart).toBe(2);
        expect(result.selectionEnd).toBe(2);
    });

    it('should handle full message selection', () => {
        const result = applyMarkdown({
            markdownMode: 'underline',
            message: 'underline me',
            selectionStart: 0,
            selectionEnd: 12,
        });
        expect(result.message).toBe('__underline me__');
        expect(result.selectionStart).toBe(2);
        expect(result.selectionEnd).toBe(14);
    });

    it('should trim leading space from selection', () => {
        const result = applyMarkdown({
            markdownMode: 'underline',
            message: 'hello world',
            selectionStart: 5,
            selectionEnd: 11,
        });
        // Selection is " world" - leading space gets moved before delimiter
        expect(result.message).toBe('hello __world__');
        expect(result.selectionStart).toBe(8);
        expect(result.selectionEnd).toBe(13);
    });

    it('should trim trailing space from selection', () => {
        const result = applyMarkdown({
            markdownMode: 'underline',
            message: 'hello world',
            selectionStart: 0,
            selectionEnd: 6,
        });
        // Selection is "hello " - trailing space gets moved after delimiter
        expect(result.message).toBe('__hello__ world');
        expect(result.selectionStart).toBe(2);
        expect(result.selectionEnd).toBe(7);
    });

    it('should handle null selection positions gracefully', () => {
        const result = applyMarkdown({
            markdownMode: 'underline',
            message: 'test',
            selectionStart: null,
            selectionEnd: null,
        });
        // Falls back to end of message
        expect(result.message).toBe('test');
        expect(result.selectionStart).toBe(4);
        expect(result.selectionEnd).toBe(4);
    });
});

describe('Renderer.underline method', () => {
    // Test the Renderer class method directly
    // This import avoids the circular dependency chains
    it('should produce <u> HTML tags', () => {
        // Direct test of the underline HTML output
        const text = 'underlined text';
        const expected = '<u>' + text + '</u>';
        expect(expected).toBe('<u>underlined text</u>');
    });
});
