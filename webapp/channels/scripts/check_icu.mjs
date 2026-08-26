// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Deterministic ICU lint for the webapp locale catalogs.
 *
 * Layer 1 -- runtime guarantee (always fails the run):
 *   - the file is valid JSON and every value is a string
 *   - key parity with en.json: no extra keys, and (unless --warn-missing-keys)
 *     no missing keys
 *   - every value parses with @formatjs/icu-messageformat-parser, the parser
 *     react-intl runs in production, so "parses here" implies "parses there"
 *   - a translation never invents a variable or tag the source does not have.
 *     An unknown variable throws MISSING_VALUE at format time and an unknown
 *     tag renders as raw markup.
 *
 * Layer 2 -- fidelity (fails unless the key is listed in the exceptions file):
 *   - a translation does not drop a variable or tag the source has. Dropping
 *     one renders fine, it just quietly loses a value or a link.
 *   - a variable shared with the source is used with the same type. Demoting
 *     {count, plural, ...} to a bare {count} still parses and still renders,
 *     it just silently stops pluralizing.
 *   - an ASCII apostrophe immediately before < or { where the source has no
 *     such quoting. In ICU that opens a quoted literal which swallows the tag
 *     or variable and everything after it. The message still parses, so this
 *     check is the only thing that catches it.
 *
 * Usage:
 *   node scripts/check_icu.mjs <en.json> <exceptions.json|-> [--warn-missing-keys] <locale.json...>
 */

import fs from 'fs';
import path from 'path';

import {parse} from '@formatjs/icu-messageformat-parser';

const argv = process.argv.slice(2);
const warnMissingKeys = argv.includes('--warn-missing-keys');
const [enPath, exceptionsPath, ...localePaths] = argv.filter((a) => a !== '--warn-missing-keys');

if (!enPath || !exceptionsPath || localePaths.length === 0) {
    console.error('usage: node scripts/check_icu.mjs <en.json> <exceptions.json|-> [--warn-missing-keys] <locale.json...>');
    process.exit(2);
}

// The exceptions file maps a key to the reason its translations legitimately
// deviate from the source structure. Only the keys are used here; the reasons
// are there so the next person to hit the check knows why the entry exists.
const exceptions = exceptionsPath === '-' ? new Set() : new Set(Object.keys(JSON.parse(fs.readFileSync(exceptionsPath, 'utf8'))));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

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
        errors.push(`${path.basename(enPath)}:${key}: source does not parse: ${e.message}`);
    }
}

for (const localePath of localePaths) {
    const name = path.basename(localePath);

    let data;
    try {
        data = JSON.parse(fs.readFileSync(localePath, 'utf8'));
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
            errors.push(`${name}:${key}: extra key not in ${path.basename(enPath)}`);
            continue;
        }
        if (typeof message !== 'string') {
            errors.push(`${name}:${key}: value is not a string`);
            continue;
        }

        let ast;
        try {
            ast = parse(message, {ignoreTag: false, requiresOtherClause: true});
        } catch (e) {
            errors.push(`${name}:${key}: does not parse: ${e.message}`);
            continue;
        }

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

        if (exceptions.has(key)) {
            continue;
        }

        for (const arg of sourceArgs.keys()) {
            if (!targetArgs.has(arg)) {
                errors.push(`${name}:${key}: source variable/tag "${arg}" is missing from the translation`);
            }
        }

        for (const [arg, types] of targetArgs) {
            const sourceTypes = sourceArgs.get(arg);
            if (!sourceTypes) {
                continue;
            }
            for (const type of types) {
                if (!sourceTypes.has(type)) {
                    errors.push(`${name}:${key}: "${arg}" is used as ${type}, but the source only uses it as ${[...sourceTypes].join('/')}`);
                }
            }
        }

        if ((/'[<{]/).test(message) && !(/'[<{]/).test(en[key])) {
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
    console.error(`\n${errors.length} error(s) across ${localePaths.length} locale file(s)`);
    process.exit(1);
}

console.log(`OK: ${localePaths.length} locale files checked against ${enPath}`);
