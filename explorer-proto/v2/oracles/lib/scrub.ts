// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Scrubber = {
    /** Scrubs free text and truncates it; ids, origins, ports, tokens, clock times and dates never survive. */
    text(input: string, max?: number): string;
    /** Sanitized URL path: id segments replaced, query reduced to its sorted key names. */
    path(urlOrPath: string): string;
    /** Throws if a serialized artefact still contains a loopback host, a URL or a known literal. */
    assertClean(serialized: string): void;
};

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const WEEKDAYS = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday';
const MIN_LITERAL = 4;

const STEPS: Array<[RegExp, string]> = [
    [/(?:https?|wss?):\/\/(?:127\.0\.0\.1|localhost|\[::1\]|0\.0\.0\.0)(?::\d+)?/gi, '<origin>'],
    [/(?:127\.0\.0\.1|localhost|\[::1\]|0\.0\.0\.0)(?::\d+)?/gi, '<host>'],
    [/\b(MMAUTHTOKEN|MMUSERID|MMCSRF|token|csrf)=[^;\s&"']+/gi, '$1=<token>'],
    [/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer <token>'],
    [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '<token>'],
    [/(?<![A-Za-z0-9])_r_[0-9a-z]+_(?![A-Za-z0-9])/g, '<react-id>'],
    [/(?<![A-Za-z0-9]):r[0-9a-z]+:(?![A-Za-z0-9])/g, '<react-id>'],
    [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '<email>'],
    [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>'],
    // Lookarounds, not \b: ids are joined by '_' and '-' in permalinks.
    [/(?<![a-z0-9])[a-z0-9]{26}(?![a-z0-9])/g, '<id>'],
    [/(?<![0-9a-f])[0-9a-f]{16,}(?![0-9a-f])/gi, '<hex>'],
    [new RegExp(`\\b(?:${MONTHS}) \\d{1,2}(?:, \\d{4})?\\b`, 'g'), '<date>'],
    [new RegExp(`\\b(?:${WEEKDAYS})\\b`, 'g'), '<weekday>'],
    [/\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/g, '<date>'],
    [/\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?\b/g, '<time>'],
    [/\b\d{6,}\b/g, '<n>'],
];

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * origins become <origin>, ids (known seeded ids) become <id>, literals (for example the seeded password) become
 * <redacted>; every other id, token and port is caught by the pattern steps.
 */
export function createScrubber(options: {origins?: string[]; ids?: string[]; literals?: string[]} = {}): Scrubber {
    const toRegExp = (values: string[]) => {
        if (values.length === 0) {
            return null;
        }
        return new RegExp(
            [...values]
                .sort((a, b) => b.length - a.length)
                .map(escapeRegExp)
                .join('|'),
            'g',
        );
    };
    const origins = (options.origins ?? []).filter((value) => value.length >= MIN_LITERAL);
    const literals = (options.literals ?? []).filter((value) => value.length >= MIN_LITERAL);
    const knownIds = (options.ids ?? []).filter((value) => value.length >= MIN_LITERAL);
    const originRe = toRegExp(origins);
    const idRe = toRegExp(knownIds);
    const literalRe = toRegExp(literals);

    const text = (input: string, max = 300): string => {
        let out = String(input);
        if (originRe) {
            out = out.replace(originRe, '<origin>');
        }
        if (idRe) {
            out = out.replace(idRe, '<id>');
        }
        if (literalRe) {
            out = out.replace(literalRe, '<redacted>');
        }
        for (const [re, replacement] of STEPS) {
            out = out.replace(re, replacement);
        }
        out = out.replace(/\s+/g, ' ').trim();
        return out.length > max ? `${out.slice(0, max)}...` : out;
    };

    const path = (urlOrPath: string): string => {
        let url: URL;
        try {
            url = new URL(urlOrPath, 'http://scrub.invalid');
        } catch {
            return '<unparseable>';
        }
        const segments = url.pathname
            .split('/')
            .map((segment) => text(decodeURIComponent(segment).replace(/\.[0-9a-f]{8,}(?=\.)/gi, '.<hash>'), 120));
        const keys = [...new Set([...url.searchParams.keys()])].sort();
        return `${segments.join('/')}${keys.length > 0 ? `?${keys.join('&')}` : ''}`;
    };

    const assertClean = (serialized: string) => {
        if (
            /(?:127\.0\.0\.1|localhost|\[::1\]|0\.0\.0\.0)/i.test(serialized) ||
            /\b(?:https?|wss?):\/\//i.test(serialized)
        ) {
            throw new Error('Scrub failure: an artefact still contains a loopback host or a URL.');
        }
        if ([...origins, ...knownIds, ...literals].some((value) => serialized.includes(value))) {
            throw new Error('Scrub failure: an artefact still contains a protected literal.');
        }
    };

    return {text, path, assertClean};
}
