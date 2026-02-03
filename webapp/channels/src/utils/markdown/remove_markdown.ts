// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import marked from 'marked';

import * as TextFormatting from 'utils/text_formatting';

// Map of HTML entities to their decoded characters.
// This should match the entities handled by Go's html.UnescapeString on the server.
const HTML_ENTITY_DECODE_MAP: Record<string, string> = {

    // Numeric entities (decimal)
    '&#33;': '!', // Exclamation Mark
    '&#34;': '"', // Double Quote
    '&#35;': '#', // Hash
    '&#38;': '&', // Ampersand
    '&#39;': "'", // Single Quote/Apostrophe
    '&#40;': '(', // Left Parenthesis
    '&#41;': ')', // Right Parenthesis
    '&#42;': '*', // Asterisk
    '&#43;': '+', // Plus Sign
    '&#45;': '-', // Dash
    '&#46;': '.', // Period
    '&#47;': '/', // Forward Slash
    '&#58;': ':', // Colon
    '&#59;': ';', // Semicolon
    '&#60;': '<', // Less Than
    '&#61;': '=', // Equals Sign
    '&#62;': '>', // Greater Than
    '&#63;': '?', // Question Mark
    '&#64;': '@', // At Sign
    '&#91;': '[', // Left Square Bracket
    '&#92;': '\\', // Backslash
    '&#93;': ']', // Right Square Bracket
    '&#94;': '^', // Caret
    '&#95;': '_', // Underscore
    '&#96;': '`', // Backtick
    '&#123;': '{', // Left Curly Brace
    '&#124;': '|', // Vertical Bar
    '&#125;': '}', // Right Curly Brace
    '&#126;': '~', // Tilde

    // Named entities (common ones handled by Go's html.UnescapeString)
    '&amp;': '&', // Ampersand
    '&lt;': '<', // Less Than
    '&gt;': '>', // Greater Than
    '&quot;': '"', // Double Quote
    '&apos;': "'", // Single Quote/Apostrophe
};

const HTML_ENTITY_PATTERN = new RegExp(
    Object.keys(HTML_ENTITY_DECODE_MAP).map((key) => TextFormatting.escapeRegex(key)).join('|'),
    'g',
);

export default class RemoveMarkdown extends marked.Renderer {
    public code(text: string) {
        // We need to escape the input here because our version of marked does this in the renderer. Every other node
        // type has its input escaped before it reaches the renderer.
        return TextFormatting.escapeHtml(text).replace(/\n/g, ' ');
    }

    public blockquote(text: string) {
        return text.replace(/\n/g, ' ');
    }

    public heading(text: string) {
        return text + ' ';
    }

    public hr() {
        return '';
    }

    public list(body: string) {
        return body;
    }

    public listitem(text: string) {
        return text + ' ';
    }

    public paragraph(text: string) {
        return text + ' ';
    }

    public table() {
        return '';
    }

    public tablerow() {
        return '';
    }

    public tablecell() {
        return '';
    }

    public strong(text: string) {
        return text;
    }

    public em(text: string) {
        return text;
    }

    public codespan(text: string) {
        return text.replace(/\n/g, ' ');
    }

    public br() {
        return ' ';
    }

    public del(text: string) {
        return text;
    }

    public link(href: string, title: string, text: string) {
        return text;
    }

    public image(href: string, title: string, text: string) {
        return text;
    }

    public text(text: string) {
        return text.
            replace('\n', ' ').
            replace(HTML_ENTITY_PATTERN, (match) => HTML_ENTITY_DECODE_MAP[match]);
    }
}
