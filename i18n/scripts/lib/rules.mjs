// The rules a new or changed translation has to pass before it lands.
//
// Webapp messages go through webapp/channels/scripts/icu_rules.mjs, the same code
// check_icu.mjs runs in CI. Server messages get the checks mmgotool i18n verify
// makes per string, so that a translation fails here, key by key, before its
// catalog is written.
//
// New work is held to more than the catalogs as they stand. Every finding has a
// severity:
//
//   error  never lands
//   soft   lands only with a stated reason, because it is usually a mistake but
//          sometimes exactly right: a product name that stays in English, a
//          sentence that leaves a brand name implicit
import fs from 'fs';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';

import {flatten} from './catalogs.mjs';
import {droppedNames} from './glossary.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const icu = await import(pathToFileURL(path.join(here, '../../../webapp/channels/scripts/icu_rules.mjs')).href);
const SERVER_PLURALS = JSON.parse(fs.readFileSync(path.join(here, 'server_plurals.json'), 'utf8'));

const {analyzeSource, checkMessage, isRightToLeft, HORIZONTAL_GLYPH} = icu;

// What CI reports as a warning, new work must not do at all, except an arrow in a
// right-to-left locale, which can be the clearest way to write a sequence.
const WEBAPP_SEVERITY = {
    'plural-category': 'error',
    'plural-unused-category': 'error',
    'rtl-arrow': 'soft',
};

const finding = (rule, severity, message) => ({rule, severity, message});

function softChecks(item, value, glossary) {
    const out = [];
    const dropped = droppedNames(glossary, item.english, value);
    if (dropped.length) {
        out.push(finding('do-not-translate', 'soft', `leaves out ${dropped.map((d) => `"${d}"`).join(', ')}, which the glossary keeps in English`));
    }
    return out;
}

const TOKEN = /\{\{\s*\.([A-Za-z0-9_]+)\s*\}\}/g;
const ACTION = /\{\{(.*?)\}\}/g;
const tokensOf = (text) => new Set([...text.matchAll(TOKEN)].map((m) => m[1]));
const actionsOf = (text) => [...text.matchAll(ACTION)].
    map((m) => m[1].trim().replace(/\s+/g, ' ')).
    filter((a) => !/^\.[A-Za-z0-9_]+$/.test(a)).
    sort();

function checkServer(item, value, locale) {
    const out = [];
    const forms = typeof value === 'string' ? [value] : Object.values(value);
    const sourceForms = typeof item.english === 'string' ? [item.english] : Object.values(item.english);

    for (const form of forms) {
        if ((form.match(/\{\{/g) || []).length !== (form.match(/\}\}/g) || []).length) {
            out.push(finding('template-syntax', 'error', 'unbalanced {{ and }}'));
            break;
        }
    }

    const sourceTokens = new Set(sourceForms.flatMap((f) => [...tokensOf(f)]));
    const tokens = new Set(forms.flatMap((f) => [...tokensOf(f)]));
    for (const t of tokens) {
        if (!sourceTokens.has(t)) {
            out.push(finding('unknown-token', 'error', `unknown template token {{.${t}}} not present in source`));
        }
    }
    for (const t of sourceTokens) {
        if (!tokens.has(t)) {
            out.push(finding('missing-token', 'error', `source template token {{.${t}}} is missing from the translation`));
        }
    }

    // {{if}}, {{else}} and {{end}} have to survive translation as they are, in
    // every form, or the template either fails to parse or shows the wrong branch.
    const sourceActions = actionsOf(sourceForms[0]).join('\n');
    if (forms.some((f) => actionsOf(f).join('\n') !== sourceActions)) {
        out.push(finding('template-action', 'error', `template actions differ from the source's: ${sourceActions ? sourceActions.split('\n').map((a) => `{{${a}}}`).join(' ') : 'none'}`));
    }

    if (typeof value === 'object') {
        const want = SERVER_PLURALS[locale];
        const have = Object.keys(value).sort();
        if (!want) {
            out.push(finding('plural-category', 'error', `no go-i18n plural categories recorded for ${locale} in i18n/scripts/lib/server_plurals.json`));
        } else if (have.join('/') !== want.join('/')) {
            out.push(finding('plural-category', 'error', `plural forms are ${have.join('/')}, but go-i18n uses exactly ${want.join('/')} for ${locale}`));
        }
    } else if (typeof item.english === 'object') {
        out.push(finding('plural-demoted', 'error', 'en.json pluralises this id but the translation is a single string, which silently stops pluralising'));
    }

    if (isRightToLeft(locale) && forms.some((f) => HORIZONTAL_GLYPH.test(f))) {
        out.push(finding('rtl-arrow', 'soft', 'horizontal arrow in a right-to-left locale points the opposite way to the reading direction'));
    }
    return out;
}

const analyzed = new Map();
function sourceFor(english) {
    if (!analyzed.has(english)) {
        analyzed.set(english, analyzeSource(english));
    }
    return analyzed.get(english);
}

/**
 * Check one translation of item, {english, description}, where english is the
 * en.json message, against the locale's glossary from readGlossary. Returns
 * findings of {rule, severity, message}.
 */
export function checkTranslation({item, value, locale, surface, glossary}) {
    const isPluralMap = surface === 'server' && value && typeof value === 'object' && !Array.isArray(value) &&
        Object.values(value).every((form) => typeof form === 'string');
    if (typeof value !== 'string' && !isPluralMap) {
        return [finding('type', 'error', surface === 'server' ? 'not a string or a map of plural forms' : 'not a string')];
    }
    if (flatten(value).trim() === '' || (isPluralMap && Object.values(value).some((f) => f.trim() === ''))) {
        return [finding('empty', 'error', 'empty')];
    }

    const out = [];
    if (/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(flatten(value))) {
        out.push(finding('encoding', 'error', 'contains a replacement character (U+FFFD) or a control character, the mark of text that went through the wrong encoding'));
    }
    if (surface === 'webapp') {
        let source;
        try {
            source = sourceFor(item.english);
        } catch (e) {
            return [finding('source', 'error', `the English does not parse, so fix en.json first: ${e.message}`)];
        }
        for (const f of checkMessage(source, value, locale)) {
            out.push({...f, severity: WEBAPP_SEVERITY[f.rule] || f.severity});
        }
    } else {
        out.push(...checkServer(item, value, locale));
    }
    out.push(...softChecks(item, value, glossary));
    return out;
}
