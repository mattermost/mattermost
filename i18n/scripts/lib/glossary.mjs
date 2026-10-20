// i18n/glossary/: en.json is the term inventory, and <locale>.json holds each
// term's target in that locale. See i18n/glossary/README.md.
import {flatten, GLOSSARY_DIR} from './catalogs.mjs';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A whole-word match. Letters and digits on either side, in any script, mean
// the term is part of a longer word.
const wordPattern = (text, flags) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(text)}(?![\\p{L}\\p{N}])`, `u${flags}`);

/**
 * A locale's glossary. tree.read(path) returns a file's text, or null if it
 * does not exist.
 */
export function readGlossary(tree, locale) {
    const read = (name) => {
        const text = tree.read(`${GLOSSARY_DIR}/${name}.json`);
        return text === null ? {} : JSON.parse(text);
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
