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
 *   - the file is in canonical form: keys in code-point order, a 2-space
 *     indent and a trailing newline, so a hand edit changes only what it means to
 *   - no value is empty or whitespace-only. react-intl replaces '' with the
 *     English, exactly as for a missing key, and renders whitespace as a blank.
 *     --warn-missing-keys does not downgrade this: a blank entry is a leftover
 *     placeholder, not work in progress.
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
 * The per-message checks live in icu_rules.mjs. Two of its rules are warnings
 * rather than errors, because the catalogs already ship strings that break
 * them:
 *
 *   - a horizontal arrow in a right-to-left locale, which points backwards
 *   - a plural that shows its count but lacks a form the locale needs for
 *     some integer, so ICU falls back to "other": "5 каналы" for "5 каналов".
 *     A source plural that itself leaves out a form English needs is not held
 *     against the translations that copy it.
 *
 * Key parity is a separate question from whether the entries that exist are
 * correct. An extra key, one en.json does not have, is only ever a warning:
 * nothing will read it, so it is dead weight rather than a defect, and is left
 * for a later sweep. An absent key is an
 * error by default and a warning under --warn-missing-keys, and is not a
 * runtime defect either way, because react-intl falls back to the source
 * message.
 *
 * Usage:
 *   node scripts/check_icu.mjs <i18n-dir> [--warn-missing-keys]
 */

import fs from 'fs';
import path from 'path';

import {analyzeSource, checkMessage} from './icu_rules.mjs';

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

// en.json pairs each key with a {defaultMessage, description}; the locale
// catalogs are flat key -> string. Flatten the source to the same shape so
// everything below compares one string against another.
let en;
try {
    en = Object.fromEntries(
        Object.entries(JSON.parse(readCatalog(SOURCE))).
            map(([key, entry]) => [key, entry.defaultMessage]),
    );
} catch (e) {
    console.error(`cannot read ${path.join(i18nDir, SOURCE)}: ${e.message}`);
    process.exit(2);
}

const errors = [];
const warnings = [];

const sources = new Map();
for (const [key, message] of Object.entries(en)) {
    try {
        sources.set(key, analyzeSource(message));
    } catch (e) {
        errors.push(`${SOURCE}:${key}: source does not parse: ${e.message}`);
    }
}

for (const name of localeNames) {
    // The plural and direction rules come from Intl, which throws on a name
    // that is not a locale tag, such as en_US.
    const locale = path.basename(name, '.json');
    try {
        Intl.getCanonicalLocales(locale);
    } catch {
        errors.push(`${name}: "${locale}" is not a locale tag, such as pt-BR`);
        continue;
    }

    let data;
    const text = readCatalog(name);
    try {
        data = JSON.parse(text);
    } catch (e) {
        errors.push(`${name}: invalid JSON: ${e.message}`);
        continue;
    }

    // Keys in code-point order, as every catalog already is, so that a hand edit
    // cannot reorder or reindent a file and bury its one real change in the diff.
    // A duplicate key also lands here: JSON.parse keeps only the last one.
    const canonical = JSON.stringify(Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]])), null, 2) + '\n';
    if (text !== canonical) {
        let at = 0;
        while (at < text.length && text[at] === canonical[at]) {
            at++;
        }
        const line = text.slice(0, at).split('\n').length;
        errors.push(`${name}: not in canonical form from line ${line}: keys in code-point order, a 2-space indent and a trailing newline`);
    }

    for (const key of Object.keys(en)) {
        if (!(key in data)) {
            (warnMissingKeys ? warnings : errors).push(`${name}:${key}: missing key`);
        }
    }

    for (const [key, message] of Object.entries(data)) {
        if (!(key in en)) {
            warnings.push(`${name}:${key}: extra key not in ${SOURCE}`);
            continue;
        }
        if (typeof message !== 'string') {
            errors.push(`${name}:${key}: value is not a string`);
            continue;
        }

        // react-intl falls back to the English for '', exactly as for a missing
        // key. A whitespace-only translation is worse: it renders, and the
        // user sees nothing at all.
        // Unlike a missing key, this is an error even under --warn-missing-keys:
        // an absent key is work in progress, but an empty one is a placeholder
        // left behind.
        if (message.trim() === '') {
            errors.push(`${name}:${key}: empty translation`);
            continue;
        }

        // Absent only when en.json's own message failed to parse, which was
        // already reported once against en.json. Comparing against a source we
        // could not read would just repeat that for every locale.
        const source = sources.get(key);
        if (!source) {
            continue;
        }

        for (const {severity, message: detail} of checkMessage(source, message, locale)) {
            (severity === 'error' ? errors : warnings).push(`${name}:${key}: ${detail}`);
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
