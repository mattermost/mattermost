// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const DYN = /\{[^{}]*\}/g;

export function compareStr(a, b) {
    if (a < b) {
        return -1;
    }
    return a > b ? 1 : 0;
}

export function regexText(literal) {
    const m = /^\/([\s\S]*)\/[a-z]*$/.exec(literal);
    let body = m ? m[1] : literal;
    body = body
        .replace(/\\[bBdDwWsS][*+?]?/g, ' ')
        .replace(/\\(.)/g, '$1')
        .replace(/\(\?[:=!<][^)]*\)?/g, ' ')
        .replace(/[.][*+?]+/g, ' ')
        .replace(/[\^$()[\]|*+?]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return body;
}

export function hint(text) {
    return `{${String(text)
        .replace(/[{}`\s]+/g, ' ')
        .trim()
        .slice(0, 40)}}`;
}

export function staticContent(text) {
    return text.replace(DYN, '').replace(/[^A-Za-z0-9]+/g, '');
}

export function isFullyDynamic(text) {
    return staticContent(text).length === 0;
}

export function compactText(text, max = 60) {
    const t = text.replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
