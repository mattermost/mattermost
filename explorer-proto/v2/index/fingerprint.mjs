// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'node:crypto';

const DYN = /\{[^{}]*\}/g;
const LABEL_KINDS = new Set([
    'css',
    'text',
    'role',
    'testid',
    'label',
    'placeholder',
    'title',
    'alt',
    'frame',
    'alias',
    'name',
    'has',
    'not',
    'value',
    'call',
    'location',
    'wrap',
    'invoke',
    'its',
]);

export const STOP_TOKENS = new Set([
    'the',
    'a',
    'an',
    'of',
    'to',
    'in',
    'and',
    'or',
    'is',
    'are',
    'be',
    'for',
    'on',
    'with',
    'at',
    'by',
    'it',
    'as',
    'ui',
    'api',
    'cy',
    'pw',
    'helper',
    'btn',
    'id',
    'div',
    'span',
    'should',
    'verify',
    'click',
    'then',
    'when',
    'that',
    'this',
    'from',
    'into',
    'has',
    'have',
    'not',
    'no',
    'test',
    'tests',
    'spec',
    'specs',
    'e2e',
    'cypress',
    'playwright',
    'integration',
    'functional',
    'get',
    'set',
    'visible',
    'exist',
    'text',
    'role',
    'css',
    'testid',
    'name',
    'first',
    'last',
    'js',
    'ts',
    'jsx',
    'tsx',
    'mm',
]);

export function stem(token) {
    let t = token;
    if (t.length > 4 && t.endsWith('ies')) {
        t = `${t.slice(0, -3)}y`;
    } else if (t.length > 5 && t.endsWith('ing')) {
        t = t.slice(0, -3);
    } else if (t.length > 4 && t.endsWith('ed')) {
        t = t.slice(0, -2);
    } else if (t.length > 4 && /(ss|x|z|ch|sh)es$/.test(t)) {
        t = t.slice(0, -2);
    } else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) {
        t = t.slice(0, -1);
    }
    if (t.length > 4 && t.endsWith('e')) {
        t = t.slice(0, -1);
    }
    return t;
}

export function normalizeText(text) {
    return String(text ?? '')
        .replace(DYN, ' ')
        .replace(/[0-9a-f]{8,}/gi, ' ')
        .replace(/\bMM-T\d+(?:_\d+)?\b/gi, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_\-./\\:#[\]()>=,"'`*+?|<~@]+/g, ' ')
        .toLowerCase()
        .replace(/\d+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function tokenize(text, {keepKinds = false} = {}) {
    const out = [];
    for (const raw of normalizeText(text).split(' ')) {
        if (!raw || raw.length < 2) {
            continue;
        }
        if (!keepKinds && LABEL_KINDS.has(raw)) {
            continue;
        }
        if (STOP_TOKENS.has(raw)) {
            continue;
        }
        const s = stem(raw);
        if (s.length >= 2 && !STOP_TOKENS.has(s)) {
            out.push(s);
        }
    }
    return out;
}

export function tokenSet(texts) {
    const set = new Set();
    for (const t of texts) {
        for (const tok of tokenize(t)) {
            set.add(tok);
        }
    }
    return set;
}

export function hashLabel(label) {
    return String(label ?? '')
        .toLowerCase()
        .replace(DYN, '')
        .replace(/[0-9a-f]{8,}/g, '')
        .replace(/\d+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function sha(parts) {
    return crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
}

export function fingerprintOf(record) {
    const actions = record.actions.filter((a) => a.phase !== 'hook').map((a) => hashLabel(a.label));
    const assertions = record.assertions
        .filter((a) => a.phase !== 'hook')
        .map((a) => `${hashLabel(a.target)}|${a.negated ? '!' : ''}${hashLabel(a.matcher)}`);
    return {
        fingerprint: sha({actions, assertions, actors: record.actors.count}),
        fingerprint_loose: sha({
            actions: [...new Set(actions)].sort(),
            assertions: [...new Set(assertions)].sort(),
            actors: record.actors.count,
        }),
    };
}

export function sha1(text) {
    return crypto.createHash('sha1').update(text).digest('hex');
}
