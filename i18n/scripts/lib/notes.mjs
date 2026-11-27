// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {NOTE_KINDS} from './validate.mjs';

const NOTE_HEADINGS = {
    english: 'Defects in the English',
    description: 'Defects in the descriptions',
    glossary: 'Glossary terms that are wrong or missing for the context',
    catalog: 'Wrong translations elsewhere in the catalogs, outside this run',
    choice: 'Translation choices to check',
};

/**
 * The translators' notes, {locale: {ref: {kind, text}}}, as notes.md: a section
 * per kind and an entry per string. Locales that wrote the same text share a
 * line, so a defect in the English that every locale reports is listed once.
 * Returns {text, counts}, counts being how many strings each kind has notes on.
 */
export function formatNotes(notesByLocale) {
    const byKind = Object.fromEntries(NOTE_KINDS.map((kind) => [kind, new Map()]));
    for (const [locale, notes] of Object.entries(notesByLocale).sort()) {
        for (const [ref, {kind, text}] of Object.entries(notes)) {
            byKind[kind].set(ref, [...(byKind[kind].get(ref) || []), {locale, text}]);
        }
    }
    const lines = [];
    const counts = {};
    for (const kind of NOTE_KINDS) {
        const notes = [...byKind[kind]].sort(([a], [b]) => a.localeCompare(b));
        if (!notes.length) {
            continue;
        }
        counts[kind] = notes.length;
        lines.push(`#### ${NOTE_HEADINGS[kind]}`, '');
        for (const [ref, by] of notes) {
            const byText = [...Map.groupBy(by, (n) => n.text)].map(([text, ns]) => [ns.map((n) => n.locale).join(', '), text]);
            if (byText.length === 1) {
                lines.push(`- \`${ref}\` (${byText[0][0]}): ${byText[0][1]}`);
            } else {
                lines.push(`- \`${ref}\``, ...byText.map(([locales, text]) => `  - ${locales}: ${text}`));
            }
        }
        lines.push('');
    }
    return {text: lines.join('\n'), counts};
}
