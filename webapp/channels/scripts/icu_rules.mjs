// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The per-message rules for the webapp locale catalogs, which check_icu.mjs
 * runs over every catalog in CI.
 *
 * Every finding carries a stable rule id and a severity, so a caller can tell
 * the rules apart without matching on message text.
 */

import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

// Resolved through react-intl: a bare import gets whichever copy npm hoisted.
const reactIntlRequire = createRequire(import.meta.resolve('react-intl'));
const {parse} = await import(pathToFileURL(reactIntlRequire.resolve('@formatjs/icu-messageformat-parser')).href);

// ignoreTag: false parses <b>...</b> as tags rather than literal text, so the
// tag checks see them; requiresOtherClause: true rejects a plural or select with
// no "other" arm, which ICU requires as the fallback.
const PARSE_OPTIONS = {ignoreTag: false, requiresOtherClause: true};

// Element type ids from @formatjs/icu-messageformat-parser's TYPE enum. They
// are inlined as numbers in the AST, so name them for legible messages.
const TYPES = {
    1: 'argument',
    2: 'number',
    3: 'date',
    4: 'time',
    5: 'select',
    6: 'plural',
    8: 'tag',
};

/**
 * Maps the role the source uses a variable in to the roles a translation may
 * promote it to.
 *
 * English needs a plural far less often than the languages it is translated
 * into: "{count} items were deleted" is one sentence in English and four in
 * Russian. Wrapping a bare {count} in {count, plural, ...} is how a translator
 * makes that sentence grammatical, and it loses nothing, so it is allowed,
 * even though the source never asked for a plural. Demotion is the reverse and
 * stays fatal.
 *
 * The formatting types are deliberately absent. They are not interchangeable
 * with each other or reachable from a bare argument: {x, number} over a string
 * renders NaN and {x, date} over a non-date renders "Invalid Date", so a
 * translation reaching for one the source did not use is a defect, not a
 * grammar fix.
 */
const PROMOTIONS = {
    argument: new Set(['plural', 'select']),
    number: new Set(['plural']),
};

// A lone ASCII apostrophe before < or { opens an ICU quoted literal that
// swallows the tag or variable. A doubled one does not: '' is the escape for a
// literal apostrophe, and l''<link> is a documented way to write an elision. So
// only an unpaired apostrophe is a defect.
const UNESCAPED_APOSTROPHE = /(?<!')'(?!')[<{]/;

// Horizontal arrows and pointers. They are not bidi-mirrored, so in a
// right-to-left sentence one meaning "next" or "leads to" points backwards.
// Vertical arrows and the ↵ key symbol read the same either way.
const HORIZONTAL_GLYPH = /[\u2190\u2192\u21D0\u21D2\u27F5\u27F6\u2794\u279C-\u27BF\u2B05\u25B6\u25B8\u25BA\u25C0\u25C2\u25C4]/u;

function isRightToLeft(locale) {
    const tag = new Intl.Locale(locale);
    return (tag.getTextInfo ? tag.getTextInfo() : tag.textInfo).direction === 'rtl';
}

function walk(ast, visit) {
    for (const el of ast) {
        visit(el);
        if (el.options) {
            for (const option of Object.values(el.options)) {
                walk(option.value, visit);
            }
        }
        if (el.children) {
            walk(el.children, visit);
        }
    }
}

/**
 * Map every variable and tag in an AST to the set of types it is used as. A
 * single name is regularly used in more than one role ("{count, number} new
 * {count, plural, one {message} other {messages}}" uses count as both a number
 * and a plural), so this has to be a set per name, not a type per name.
 *
 * Plural categories are deliberately not compared: which categories a message
 * needs is a property of the locale, not of the source string.
 */
function argTypes(ast) {
    const out = new Map();
    walk(ast, (el) => {
        if (TYPES[el.type] && el.value !== undefined) {
            if (!out.has(el.value)) {
                out.set(el.value, new Set());
            }
            out.get(el.value).add(TYPES[el.type]);
        }
    });
    return out;
}

/**
 * Parse a source message once, for checking any number of translations of it.
 * Throws if the source does not parse.
 */
export function analyzeSource(message) {
    const ast = parse(message, PARSE_OPTIONS);
    return {message, args: argTypes(ast)};
}

const finding = (rule, severity, message) => ({rule, severity, message});

/**
 * Check one translation against its analyzed source. Returns findings of
 * {rule, severity, message}, where severity is "error" or "warning".
 *
 *   errors   parse, unknown-argument, missing-argument, argument-role, apostrophe
 *   warnings rtl-arrow
 */
export function checkMessage(source, message, locale) {
    const findings = [];

    if (isRightToLeft(locale) && HORIZONTAL_GLYPH.test(message)) {
        findings.push(finding('rtl-arrow', 'warning', 'horizontal arrow in a right-to-left locale points the opposite way to the reading direction'));
    }

    let ast;
    try {
        ast = parse(message, PARSE_OPTIONS);
    } catch (e) {
        findings.push(finding('parse', 'error', `does not parse: ${e.message}`));
        return findings;
    }

    const sourceArgs = source.args;
    const targetArgs = argTypes(ast);
    for (const arg of targetArgs.keys()) {
        if (!sourceArgs.has(arg)) {
            findings.push(finding('unknown-argument', 'error', `unknown variable/tag "${arg}" not present in source`));
        }
    }

    for (const arg of sourceArgs.keys()) {
        if (!targetArgs.has(arg)) {
            findings.push(finding('missing-argument', 'error', `source variable/tag "${arg}" is missing from the translation`));
        }
    }

    for (const [arg, types] of targetArgs) {
        // Not in the source at all, which the unknown-variable check above has
        // already reported.
        const sourceTypes = sourceArgs.get(arg);
        if (!sourceTypes) {
            continue;
        }
        for (const type of types) {
            if (sourceTypes.has(type)) {
                continue;
            }
            if ([...sourceTypes].some((sourceType) => PROMOTIONS[sourceType]?.has(type))) {
                continue;
            }
            findings.push(finding('argument-role', 'error', `"${arg}" is used as ${type}, but the source only uses it as ${[...sourceTypes].join('/')}`));
        }
    }

    // Only when the source is clean. The same quoting in en.json is the author's
    // own, and blaming each translation for it would report the one source
    // defect once per locale.
    if (UNESCAPED_APOSTROPHE.test(message) && !UNESCAPED_APOSTROPHE.test(source.message)) {
        findings.push(finding('apostrophe', 'error', 'ASCII apostrophe before ICU syntax opens a quoted literal and swallows the rest of the message; use ’ or \'\' instead'));
    }

    return findings;
}
