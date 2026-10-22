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

function literalText(ast, out = []) {
    for (const el of ast) {
        if (el.type === 0) {
            out.push(el.value);
        }
        if (el.options) {
            for (const option of Object.values(el.options)) {
                literalText(option.value, out);
            }
        }
        if (el.children) {
            literalText(el.children, out);
        }
    }
    return out;
}

function proseOf(value, surface) {
    let text;
    if (surface === 'webapp') {
        try {
            text = literalText(icu.parse(value, icu.PARSE_OPTIONS)).join(' ');
        } catch {
            text = value;
        }
    } else {
        text = flatten(value).replace(/\{\{[^}]*\}\}/g, ' ');
    }
    return text.replace(/[a-z][a-z0-9+.-]*:\/\/\S*|\S+@\S+\.\S+/gi, ' ');
}

const WORD = /(?<![\p{L}\p{N}._/#@:\\-])[\p{L}\p{N}][\p{L}\p{N}'’._/-]*/gu;
const CODE_LITERALS = new Set(['true', 'false', 'null', 'nil']);
const QUOTED = /`[^`]*`|"[^"\n]*"|“[^”\n]*”|'[^'\s]*'/g;

/**
 * The words in a source string a translator would translate: its literal text,
 * less URLs, email addresses, doNotTranslate names, and anything shaped like an
 * identifier (SAML, AD/LDAP, maxFileSize, file.json, v2, .png, /header, @all,
 * manage_system, [on|off]).
 */
function translatableWords(english, surface, glossary) {
    let text = proseOf(english, surface);
    for (const entry of glossary) {
        if (entry.doNotTranslate) {
            for (const {re} of entry.patterns) {
                text = text.replace(new RegExp(re.source, 'gu'), ' ');
            }
        }
    }
    const tokens = (text.replace(/[\p{L}\p{N}]*_[\p{L}\p{N}_]*|[\p{L}\p{N}]+=|\[[^\]]*\|[^\]]*\]/gu, ' ').match(WORD) || []).map((w) => w.replace(/[._/'’-]+$/u, ''));
    return tokens.filter((w) => (
        w.length > 1 &&
        !CODE_LITERALS.has(w) &&
        !/\d/.test(w) &&
        !/[._/]/.test(w) &&
        !/^\p{Lu}{2,}s?$/u.test(w) &&
        !/\p{Ll}\p{Lu}/u.test(w)
    ));
}

// A Latin-script language can share a word or two with English, "Status" or
// "Server", and be right. A language in any other script almost never can.
const isLatinScript = (locale) => new Intl.Locale(locale).maximize().script === 'Latn';
const isEnglish = (locale) => new Intl.Locale(locale).language === 'en';
const unquoted = (value) => (typeof value === 'string' ? value.replace(QUOTED, ' ') : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, v.replace(QUOTED, ' ')])));

function addressFindings(value, locale, surface, style) {
    if (!style) {
        return [];
    }
    const found = [...new Set([...proseOf(unquoted(value), surface).matchAll(style.avoidRe)].map((m) => m[1]))];
    return found.length ? [finding('address', 'soft', `${found.map((w) => `"${w}"`).join(', ')}: ${locale} addresses the user ${style.address}ly (${style.use.join(', ')})`)] : [];
}

function softChecks(item, value, locale, surface, glossary, style) {
    const out = [];
    if (!isEnglish(locale) && flatten(value) === flatten(item.english)) {
        // A name is capitalised, and a quoted label can rightly stay in English;
        // three other ordinary words are a sentence nobody translated.
        const words = translatableWords(item.english, surface, glossary);
        const ordinary = translatableWords(unquoted(item.english), surface, glossary).filter((w) => w === w.toLowerCase());
        const severity = ordinary.length >= 3 ? 'error' : 'soft';
        if (words.length >= (isLatinScript(locale) ? 2 : 1)) {
            out.push(finding('identical-to-english', severity, `identical to the English, which has words to translate (${words.slice(0, 4).join(' ')})`));
        }
    } else if (!isEnglish(locale) && !isLatinScript(locale)) {
        // Lowercase words only: a capitalised one is usually a name, and a quoted
        // one a value the user types.
        const source = new Set(translatableWords(unquoted(item.english), surface, glossary).filter((w) => w === w.toLowerCase()));
        const kept = [...new Set(translatableWords(unquoted(value), surface, glossary).filter((w) => source.has(w)))];
        if (kept.length) {
            out.push(finding('english-words', 'soft', `keeps English words from the source: ${kept.slice(0, 6).join(', ')}`));
        }
    }
    out.push(...addressFindings(value, locale, surface, style));
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
    filter((a) => !/^\.[A-Za-z0-9_]+$/.test(a));

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

    // {{if}}, {{else}} and {{end}} have to survive translation as they are and in
    // the same order, which is what nests them, in every form, or the template
    // either fails to parse or shows the wrong branch.
    const sourceActions = actionsOf(sourceForms[0]).join('\n');
    if (forms.some((f) => actionsOf(f).join('\n') !== sourceActions)) {
        out.push(finding('template-action', 'error', `template actions differ from the source's, in order: ${sourceActions ? sourceActions.split('\n').map((a) => `{{${a}}}`).join(' ') : 'none'}`));
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
 * en.json message, against the locale's glossary and style from readGlossary
 * and readStyle. Returns findings of {rule, severity, message}.
 */
export function checkTranslation({item, value, locale, surface, glossary, style = null}) {
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
    out.push(...softChecks(item, value, locale, surface, glossary, style));
    return out;
}

/**
 * Defects in an existing translation that a run may repair: a webapp plural
 * missing a form its locale uses, and the wrong form of address.
 */
export function repairProblems({english, value, locale, surface, style}) {
    const problems = [];
    if (surface === 'webapp') {
        try {
            problems.push(...checkMessage(sourceFor(english), value, locale).filter((f) => f.rule === 'plural-category').map((f) => f.message));
        } catch {
            return [];
        }
    }
    problems.push(...addressFindings(value, locale, surface, style).map((f) => f.message));
    return problems;
}
