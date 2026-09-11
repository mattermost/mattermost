// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Deterministic ICU lint for the webapp locale catalogs.
 *
 * Every check below fails the run, ordered here from breaks-at-runtime to
 * renders-but-wrong. There is no way to exempt a key: a translation that
 * deviates from its source is either wrong, or the source is encoding English
 * grammar the other languages cannot follow, and both are worth fixing rather
 * than recording.
 *
 *   - the file is valid JSON and every value is a string
 *   - every value parses with @formatjs/icu-messageformat-parser, the parser
 *     react-intl runs in production, so "parses here" implies "parses there"
 *   - a translation never invents a variable the source does not have. An
 *     unknown variable throws MISSING_VALUE at format time.
 *   - a translation never invents a tag the source does not have. An unknown
 *     tag renders as raw markup.
 *   - a translation does not drop a variable or tag the source has. Dropping
 *     one renders fine, it just quietly loses a value or a link.
 *   - a variable shared with the source is not used in a weaker role than the
 *     source uses it. Demoting {count, plural, ...} to a bare {count} still
 *     parses and still renders, it just silently stops pluralizing. The
 *     opposite direction is allowed: see PROMOTIONS.
 *   - an unescaped ASCII apostrophe immediately before < or { where the source
 *     has no such quoting. In ICU that opens a quoted literal which swallows the tag
 *     or variable and everything after it. The message still parses, so this
 *     check is the only thing that catches it.
 *
 * Key parity is a separate question from whether the entries that exist are
 * correct. An extra key, one en.json does not have, is always an error: nothing
 * will ever read it. A missing key is an error by default and a warning under
 * --warn-missing-keys, and is not a runtime defect either way, because
 * react-intl falls back to the source message.
 *
 * Usage:
 *   node scripts/check_icu.mjs <i18n-dir> [--warn-missing-keys]
 */

import fs from 'fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'path';

// Resolved through react-intl: a bare import gets whichever copy npm hoisted.
const reactIntlRequire = createRequire(import.meta.resolve('react-intl'));
const {parse} = await import(pathToFileURL(reactIntlRequire.resolve('@formatjs/icu-messageformat-parser')).href);

const SOURCE = 'en.json';

const argv = process.argv.slice(2);
const warnMissingKeys = argv.includes('--warn-missing-keys');
const [i18nDir, ...extra] = argv.filter((a) => a !== '--warn-missing-keys');

if (!i18nDir || extra.length) {
    console.error('usage: node scripts/check_icu.mjs <i18n-dir> [--warn-missing-keys]');
    process.exit(2);
}

const readCatalog = (name) => fs.readFileSync(path.join(i18nDir, name), 'utf8');

// Sorted because readdir order is filesystem dependent, and the report has to
// be stable across runs and diffable between them.
let localeNames;
try {
    localeNames = fs.readdirSync(i18nDir, {withFileTypes: true}).
        filter((entry) => entry.isFile() && path.extname(entry.name) === '.json' && entry.name !== SOURCE).
        map((entry) => entry.name).
        sort();
} catch (e) {
    console.error(`cannot read the i18n directory ${i18nDir}: ${e.message}`);
    process.exit(2);
}

if (localeNames.length === 0) {
    console.error(`no locale catalogs beside ${SOURCE} in ${i18nDir}`);
    process.exit(2);
}

let en;
try {
    en = JSON.parse(readCatalog(SOURCE));
} catch (e) {
    console.error(`cannot read ${path.join(i18nDir, SOURCE)}: ${e.message}`);
    process.exit(2);
}

// A lone ASCII apostrophe before < or { opens an ICU quoted literal that
// swallows the tag or variable. A doubled one does not: '' is the escape for a
// literal apostrophe, and l''<link> is a documented way to write an elision. So
// only an unpaired apostrophe is a defect.
const UNESCAPED_APOSTROPHE = /(?<!')'(?!')[<{]/;

const errors = [];
const warnings = [];

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
 * makes that sentence grammatical, and it loses nothing -- so it is allowed,
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

/**
 * Map every variable and tag in an AST to the set of types it is used as. A
 * single name is regularly used in more than one role -- "{count, number} new
 * {count, plural, one {message} other {messages}}" uses count as both a number
 * and a plural -- so this has to be a set per name, not a type per name.
 *
 * Plural categories are deliberately not compared: which categories a message
 * needs is a property of the locale, not of the source string.
 */
function argTypes(ast, out = new Map()) {
    for (const el of ast) {
        if (TYPES[el.type] && el.value !== undefined) {
            if (!out.has(el.value)) {
                out.set(el.value, new Set());
            }
            out.get(el.value).add(TYPES[el.type]);
        }
        if (el.options) {
            for (const option of Object.values(el.options)) {
                argTypes(option.value, out);
            }
        }
        if (el.children) {
            argTypes(el.children, out);
        }
    }
    return out;
}

const enArgs = new Map();
for (const [key, message] of Object.entries(en)) {
    try {
        enArgs.set(key, argTypes(parse(message, {ignoreTag: false, requiresOtherClause: true})));
    } catch (e) {
        errors.push(`${SOURCE}:${key}: source does not parse: ${e.message}`);
    }
}

for (const name of localeNames) {
    let data;
    try {
        data = JSON.parse(readCatalog(name));
    } catch (e) {
        errors.push(`${name}: invalid JSON: ${e.message}`);
        continue;
    }

    for (const key of Object.keys(en)) {
        if (!(key in data)) {
            (warnMissingKeys ? warnings : errors).push(`${name}:${key}: missing key`);
        }
    }

    for (const [key, message] of Object.entries(data)) {
        if (!(key in en)) {
            errors.push(`${name}:${key}: extra key not in ${SOURCE}`);
            continue;
        }
        if (typeof message !== 'string') {
            errors.push(`${name}:${key}: value is not a string`);
            continue;
        }

        // ignoreTag: false parses <b>...</b> as tags rather than literal text,
        // so the tag checks below see them; requiresOtherClause: true rejects a
        // plural or select with no "other" arm, which ICU requires as the fallback.
        let ast;
        try {
            ast = parse(message, {ignoreTag: false, requiresOtherClause: true});
        } catch (e) {
            errors.push(`${name}:${key}: does not parse: ${e.message}`);
            continue;
        }

        // Absent only when en.json's own message failed to parse, which was
        // already reported once against en.json. Comparing against a source we
        // could not read would just repeat that for every locale.
        const sourceArgs = enArgs.get(key);
        if (!sourceArgs) {
            continue;
        }

        const targetArgs = argTypes(ast);
        for (const arg of targetArgs.keys()) {
            if (!sourceArgs.has(arg)) {
                errors.push(`${name}:${key}: unknown variable/tag "${arg}" not present in source`);
            }
        }

        for (const arg of sourceArgs.keys()) {
            if (!targetArgs.has(arg)) {
                errors.push(`${name}:${key}: source variable/tag "${arg}" is missing from the translation`);
            }
        }

        for (const [arg, types] of targetArgs) {
            // Not in the source at all, which the unknown-variable check above
            // has already reported.
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
                errors.push(`${name}:${key}: "${arg}" is used as ${type}, but the source only uses it as ${[...sourceTypes].join('/')}`);
            }
        }

        // Only when the source is clean. The same quoting in en.json is the
        // author's own, and blaming each translation for it would report the one
        // source defect once per locale.
        if (UNESCAPED_APOSTROPHE.test(message) && !UNESCAPED_APOSTROPHE.test(en[key])) {
            errors.push(`${name}:${key}: ASCII apostrophe before ICU syntax opens a quoted literal and swallows the rest of the message; use ’ or '' instead`);
        }
    }
}

if (warnings.length) {
    console.warn(warnings.join('\n'));
    console.warn(`\n${warnings.length} warning(s)`);
}

if (errors.length) {
    console.error(errors.join('\n'));
    console.error(`\n${errors.length} error(s) across ${localeNames.length} locale file(s)`);
    process.exit(1);
}

console.log(`OK: ${localeNames.length} locale files checked against ${path.join(i18nDir, SOURCE)}`);
