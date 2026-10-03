// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Search modifiers understood by the server, see model.searchFlags.
const searchModifiers = ['from', 'channel', 'in', 'before', 'after', 'on', 'ext'];

const searchModifierRegex = new RegExp(`^-?(${searchModifiers.join('|')}):`, 'i');

export function isSearchModifier(term: string): boolean {
    return searchModifierRegex.test(term);
}

// quoteSearchTerms wraps each term in quotes so that terms split by dashes or other symbols are
// treated as a single unit. Search modifiers (in:, from:, ...) are left unquoted so that they keep
// filtering the search instead of being matched as literal text. A modifier written with its value
// in the next word (`in: town-square`) is left alone as well, matching how the server parses flags.
export function quoteSearchTerms(terms: string): string {
    const words = terms.split(' ').filter((word) => Boolean(word && word.trim()));

    const quoted: string[] = [];
    let isModifierValue = false;

    for (const word of words) {
        if (isModifierValue) {
            isModifierValue = false;
            quoted.push(word);
        } else if (isSearchModifier(word)) {
            isModifierValue = word.endsWith(':');
            quoted.push(word);
        } else {
            quoted.push(`"${word}"`);
        }
    }

    return quoted.join(' ');
}
