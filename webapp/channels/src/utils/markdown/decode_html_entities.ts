// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Allowlist of HTML entities to decode. Intentionally a subset of Go's html.UnescapeString —
// only the 5 standard named entities and common ASCII decimal numeric entities are supported.
// Hex entities (&#xNN;) and the full HTML5 named set are excluded to keep the surface area
// minimal for React JSX rendering contexts (attachment titles, author names, footers).
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
    Object.keys(HTML_ENTITY_DECODE_MAP).map((key) => RegExp.escape(key)).join('|'),
    'g',
);

export function decodeHtmlEntities(text: string): string {
    return text.replace(HTML_ENTITY_PATTERN, (match) => HTML_ENTITY_DECODE_MAP[match]);
}
