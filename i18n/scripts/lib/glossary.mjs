// i18n/glossary/: en.json is the term inventory, and <locale>.json holds each
// term's target in that locale. See i18n/glossary/README.md.
//
// i18n/style.json: how each locale's catalogs address the user, formally or
// informally (address), the pronouns that say so (use), and the pronouns that
// would mean the other (avoid). matchCase matches avoid only as written, for a
// formal pronoun that is an ordinary one capitalized: German "Sie" is "you",
// "sie" is "she" or "they".
import {flatten, GLOSSARY_DIR, STYLE} from './catalogs.mjs';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wordPattern = (text, flags) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(text)}(?![\\p{L}\\p{N}])`, `u${flags}`);

// An array or a number would read as an empty glossary or style, and turn their
// rules off rather than fail.
function parseObject(text, file) {
    let body;
    try {
        body = JSON.parse(text);
    } catch (e) {
        throw new Error(`${file}: ${e.message}`);
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error(`${file}: not a JSON object`);
    }
    return body;
}

export function readGlossary(tree, locale) {
    const read = (name) => {
        const file = `${GLOSSARY_DIR}/${name}.json`;
        const text = tree.read(file);
        return text === null ? {} : parseObject(text, file);
    };
    const terms = read('en');
    const targets = read(locale);
    return Object.entries(terms).map(([term, entry]) => ({
        term,
        ...entry,
        aliases: entry.aliases || [],
        target: targets[term]?.target,
        note: targets[term]?.note,

        // A doNotTranslate name is matched exactly as written: "Mattermost", not
        // "mattermost.com". Everything else is ordinary vocabulary, which English
        // capitalizes at the start of a sentence and in title case.
        patterns: [term, ...(entry.aliases || [])].map((form) => ({form, re: wordPattern(form, entry.doNotTranslate ? '' : 'i')})),
    }));
}

/** The glossary entries a source string uses, as hints for its translator. */
export function termsIn(glossary, english) {
    const text = flatten(english);
    const out = [];
    for (const entry of glossary) {
        if (entry.patterns.some(({re}) => re.test(text))) {
            out.push({
                term: entry.term,
                ...(entry.target === undefined ? {} : {target: entry.target}),
                ...(entry.note ? {note: entry.note} : {}),
                ...(entry.doNotTranslate ? {doNotTranslate: true} : {}),
                ...(entry.commonWord ? {commonWord: true} : {}),
            });
        }
    }
    return out;
}

/**
 * A locale's style.json entry, with avoid compiled into one pattern, or null.
 * skipSentenceStart is for languages whose formal pronoun is also an ordinary
 * one at the start of a sentence: German "Sie" is "you" mid-sentence, but can be
 * "they" first.
 */
export function readStyle(tree, locale) {
    const text = tree.read(STYLE);
    const entry = text === null ? null : parseObject(text, STYLE)[locale];
    if (!entry) {
        return null;
    }
    const start = entry.skipSentenceStart ? '(?<![.!?:\\n]\\s*|^\\s*|["“„«(*]\\s*)' : '';
    const words = entry.avoid.map(escape).join('|');
    return {...entry, avoidRe: new RegExp(`${start}(?<![\\p{L}\\p{N}'’])(${words})(?![\\p{L}\\p{N}])`, entry.matchCase ? 'gu' : 'giu')};
}

/**
 * The doNotTranslate names an English source uses that its translation leaves
 * out. A commonWord term is skipped: "Channels" is the product in one string and
 * the start of a sentence about channels in the next, and the English reads the
 * same either way.
 */
export function droppedNames(glossary, english, translation) {
    const source = flatten(english);
    const target = flatten(translation);
    const dropped = [];
    for (const entry of glossary) {
        if (!entry.doNotTranslate || entry.commonWord) {
            continue;
        }
        for (const {form, re} of entry.patterns) {
            if (re.test(source) && !target.includes(form)) {
                dropped.push(form);
            }
        }
    }
    return dropped;
}
