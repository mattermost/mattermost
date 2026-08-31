// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import marked from 'marked';

// Based on extensions/autolink.c from https://github.com/github/cmark

const URL_PREFIX = /^(?:[A-Za-z][A-Za-z\d.+-]*:(?:\/{1,3}|[\p{L}\d%])|www\d{0,3}\.|[\p{L}\d.-]+[.]\p{L}{2,4}\/)/u;

// Returns true if c is ASCII whitespace.
function isWhitespace(c: string): boolean {
    return c === ' ' || c === '\t' || c === '\n' || c === '\u000b' || c === '\u000c' || c === '\r';
}

// Full-width and CJK punctuation always terminates a URL in GFM autolinking.
function isFullWidthOrCjkUrlTerminator(c: string): boolean {
    const code = c.codePointAt(0);
    if (code === undefined) {
        return false;
    }

    if (code >= 0xFF01 && code <= 0xFF0F) {
        return true;
    }
    if (code >= 0xFF1A && code <= 0xFF20) {
        return true;
    }
    if (code >= 0xFF3B && code <= 0xFF40) {
        return true;
    }
    if (code >= 0xFF5B && code <= 0xFF5E) {
        return true;
    }
    if (code === 0x3001 || code === 0x3002) {
        return true;
    }
    if (code >= 0x300C && code <= 0x3011) {
        return true;
    }

    return c === '\u00AB' || c === '\u00BB' || c === '\u201C' || c === '\u201D' || c === '\u2018' || c === '\u2019';
}

// Returns false for trailing punctuation that should be trimmed from an autolink.
function canEndAutolink(c: string): boolean {
    switch (c) {
    case '?':
    case '!':
    case '.':
    case ',':
    case ':':
    case '*':
    case '_':
    case '~':
    case '\'':
    case '"':
        return false;
    default:
        return true;
    }
}

// Returns true if a trailing '>' should be trimmed (no earlier '<' in the link).
function shouldTrimTrailingAngleBracket(runes: string[], linkEnd: number): boolean {
    for (let i = 0; i < linkEnd - 1; i++) {
        if (runes[i] === '<') {
            return false;
        }
    }

    return true;
}

// Returns true if src[position] looks like the start of an HTML tag
// (<tag>, <tag/>, <tag ...>, or </).
function looksLikeHtmlTagAt(src: string, position: number): boolean {
    if (src[position] !== '<' || position + 1 >= src.length) {
        return false;
    }

    const next = src[position + 1];
    if (next === '/') {
        return true;
    }

    if (!/[a-zA-Z]/.test(next)) {
        return false;
    }

    let i = position + 2;
    while (i < src.length && /[a-zA-Z0-9]/.test(src[i])) {
        i++;
    }

    if (i >= src.length) {
        return false;
    }

    if (src[i] === '>') {
        return true;
    }
    if (src[i] === '/') {
        return i + 1 < src.length && src[i + 1] === '>';
    }
    if (src[i] === ' ' || src[i] === '\t') {
        for (i++; i < src.length; i++) {
            if (src[i] === '>') {
                return true;
            }
            if (src[i] === '<' || src[i] === '\n' || src[i] === '\r') {
                return false;
            }
        }
    }

    return false;
}

// Stop at </ or at an opening HTML tag glued to the host (www.example.com<b>),
// but allow angle brackets in path, query, or fragment (godbolt <meta>).
function shouldStopAtAngleBracket(src: string, position: number, urlStart: number): boolean {
    if (src[position] !== '<') {
        return false;
    }

    if (position + 1 < src.length && src[position + 1] === '/') {
        return true;
    }

    if (position > 0) {
        const beforeAngle = src[position - 1];
        if (beforeAngle === '+' || beforeAngle === '#' || beforeAngle === '(' || beforeAngle === '\'' || beforeAngle === '%' || beforeAngle === '=') {
            return false;
        }
    }

    let afterHost = urlStart;
    const schemeIdx = src.indexOf('://', urlStart);
    if (schemeIdx >= 0) {
        afterHost = schemeIdx + 3;
    }

    for (let i = afterHost; i < position; i++) {
        const c = src[i];
        if (c === '/' || c === '#' || c === '?') {
            if (looksLikeHtmlTagAt(src, position) && position > 0) {
                const beforeAngle = src[position - 1];
                if (beforeAngle !== '+' && beforeAngle !== '#' && beforeAngle !== '(' && beforeAngle !== '\'' && beforeAngle !== '%' && beforeAngle !== '=') {
                    return true;
                }
            }
            return false;
        }
    }

    return true;
}

// Removes trailing punctuation, entities, and unmatched brackets from an autolink URL.
export function trimTrailingCharactersFromLink(url: string): string {
    const runes = [...url];
    let linkEnd = runes.length;

    while (linkEnd > 0) {
        const c = runes[linkEnd - 1];

        if (!canEndAutolink(c)) {
            linkEnd--;
        } else if (c === '>') {
            if (shouldTrimTrailingAngleBracket(runes, linkEnd)) {
                linkEnd--;
            } else {
                break;
            }
        } else if (c === ';') {
            let newEnd = linkEnd - 2;
            while (newEnd > 0 && /[a-zA-Z]/.test(runes[newEnd])) {
                newEnd--;
            }

            if (newEnd < linkEnd - 2 && runes[newEnd] === '&') {
                linkEnd = newEnd;
            } else {
                linkEnd--;
            }
        } else if (c === ')') {
            let numClosing = 0;
            let numOpening = 0;

            for (let i = 0; i < linkEnd; i++) {
                if (runes[i] === '(') {
                    numOpening++;
                } else if (runes[i] === ')') {
                    numClosing++;
                }
            }

            if (numClosing <= numOpening) {
                break;
            }

            linkEnd--;
        } else {
            break;
        }
    }

    return runes.slice(0, linkEnd).join('');
}

// Extends a URL match past its scheme/www prefix until a terminator, then trims the end.
function extendUrl(src: string, prefixLength: number, urlStart = 0): string {
    let end = prefixLength;

    while (end < src.length) {
        const c = src[end];

        if (c === '\n' || c === '\r') {
            break;
        }

        if (shouldStopAtAngleBracket(src, end, urlStart)) {
            break;
        }

        if (isWhitespace(c) || isFullWidthOrCjkUrlTerminator(c)) {
            break;
        }

        end++;
    }

    return trimTrailingCharactersFromLink(src.substring(0, end));
}

// Matches a GFM-style autolink at the start of src, returning a RegExpExecArray-like result.
export function matchGFMUrl(src: string): RegExpExecArray | null {
    const prefix = URL_PREFIX.exec(src);
    if (!prefix) {
        return null;
    }

    const url = extendUrl(src, prefix[0].length);
    if (!url) {
        return null;
    }

    return Object.assign([url], {
        index: 0,
        input: src,
    }) as RegExpExecArray;
}

type MatcherRule = {exec: (src: string) => RegExpExecArray | null};

let installed = false;

// Installs matchGFMUrl as marked's inline URL matcher for GFM/breaks/normal/pedantic rules.
export function installCustomUrlMatcher(): void {
    if (installed) {
        return;
    }

    const urlMatcher: MatcherRule = {exec: matchGFMUrl};

    marked.InlineLexer.rules.gfm.url = urlMatcher as unknown as RegExp;
    marked.InlineLexer.rules.breaks.url = urlMatcher as unknown as RegExp;
    marked.InlineLexer.rules.normal.url = urlMatcher as unknown as RegExp;
    marked.InlineLexer.rules.pedantic.url = urlMatcher as unknown as RegExp;

    installed = true;
}

installCustomUrlMatcher();
