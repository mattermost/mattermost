// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The per-message rules for the webapp locale catalogs.
 *
 * check_icu.mjs runs them over every catalog in CI, and the translation pipeline
 * in i18n/scripts/ runs them over each translation before it lands. There is one
 * copy so that what the pipeline accepts is exactly what CI accepts.
 *
 * Every finding carries a stable rule id, and its severity here is the one CI
 * uses. The pipeline holds new translations to a stricter standard than the
 * catalogs as they stand, so it maps some warnings to errors by rule id.
 */

import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

// Resolved through react-intl: a bare import gets whichever copy npm hoisted.
const reactIntlRequire = createRequire(import.meta.resolve('react-intl'));
export const {parse} = await import(pathToFileURL(reactIntlRequire.resolve('@formatjs/icu-messageformat-parser')).href);

// ignoreTag: false parses <b>...</b> as tags rather than literal text, so the
// tag checks see them; requiresOtherClause: true rejects a plural or select with
// no "other" arm, which ICU requires as the fallback.
export const PARSE_OPTIONS = {ignoreTag: false, requiresOtherClause: true};

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
const TYPE_PLURAL = 6;
const TYPE_POUND = 7;

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
export const HORIZONTAL_GLYPH = /[\u2190\u2192\u21D0\u21D2\u27F5\u27F6\u2794\u279C-\u27BF\u2B05\u25B6\u25B8\u25BA\u25C0\u25C2\u25C4]/u;

export function isRightToLeft(locale) {
    const tag = new Intl.Locale(locale);
    return (tag.getTextInfo ? tag.getTextInfo() : tag.textInfo).direction === 'rtl';
}

// The counts a plural rule is evaluated over. Every category an integer in this
// range selects is one a user will see; a category only fractions or numbers in
// the millions select (French "many", Lithuanian "many") is not required.
const COUNTS = Array.from({length: 1001}, (_, n) => n);

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
 */
export function argTypes(ast) {
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

const pluralRules = new Map();
function pluralRule(locale, type) {
    const id = `${locale}:${type}`;
    if (!pluralRules.has(id)) {
        pluralRules.set(id, new Intl.PluralRules(locale, {type}));
    }
    return pluralRules.get(id);
}

const CATEGORY_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];

/**
 * The categories a plural node needs but does not have, in CLDR order, each
 * with an example count that selects it: the smallest positive one, or 0. An
 * explicit =N arm covers the count N, and "other" is never missing, since the
 * parser requires it.
 */
function missingCategories(node, locale) {
    const rule = pluralRule(locale, node.pluralType || 'cardinal');
    const exact = new Set(Object.keys(node.options).filter((c) => c.startsWith('=')).map((c) => Number(c.slice(1))));
    const examples = new Map();
    for (const n of COUNTS) {
        if (exact.has(n)) {
            continue;
        }
        const category = rule.select(n - (node.offset || 0));
        if (category !== 'other' && !(category in node.options) && (!examples.has(category) || examples.get(category) === 0)) {
            examples.set(category, n);
        }
    }
    return new Map(CATEGORY_ORDER.filter((c) => examples.has(c)).map((c) => [c, examples.get(c)]));
}

// Whether a plural's count reaches the user: a # in one of its category arms,
// or the variable rendered elsewhere in the message. Without the number on
// screen, which plural form a language's few/many distinction picks rarely
// changes the words.
function displaysCount(node, ast) {
    let shown = Object.entries(node.options).some(([category, option]) => {
        if (category.startsWith('=')) {
            return false;
        }
        let pound = false;
        walk(option.value, (el) => {
            pound ||= el.type === TYPE_POUND;
        });
        return pound;
    });
    walk(ast, (el) => {
        shown ||= (el.type === 1 || el.type === 2) && el.value === node.value;
    });
    return shown;
}

function pluralNodes(ast) {
    const nodes = [];
    walk(ast, (el) => {
        if (el.type === TYPE_PLURAL) {
            nodes.push(el);
        }
    });
    return nodes;
}

/**
 * Parse a source message once, for checking any number of translations of it.
 * Throws if the source does not parse.
 *
 * A source plural that already leaves out a form English needs ("=0 {none}
 * other {# Scheduled}", where "1 Scheduled" reads fine) marks its variable as
 * deliberately incomplete, and a translation that copies the shape is not held
 * to more than the source is.
 */
export function analyzeSource(message) {
    const ast = parse(message, PARSE_OPTIONS);
    const incompletePlurals = new Set();
    for (const node of pluralNodes(ast)) {
        if (missingCategories(node, 'en').size) {
            incompletePlurals.add(node.value);
        }
    }
    return {message, args: argTypes(ast), incompletePlurals};
}

const finding = (rule, severity, message) => ({rule, severity, message});

/**
 * Check one translation against its analyzed source. Returns findings of
 * {rule, severity, message}, where severity is "error" or "warning".
 *
 *   errors   parse, unknown-argument, missing-argument, argument-role, apostrophe
 *   warnings rtl-arrow, plural-category, plural-unused-category
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

    // ICU falls back to "other" for a category the message lacks, so this
    // renders, just in the wrong grammatical form: "5 каналы" for "5 каналов".
    const used = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    for (const node of pluralNodes(ast)) {
        if (!source.incompletePlurals.has(node.value) && displaysCount(node, ast)) {
            const missing = missingCategories(node, locale);
            if (missing.size) {
                const forms = [...missing.keys()].join('/');
                const counts = [...missing.values()].join(', ');
                findings.push(finding('plural-category', 'warning', `plural "${node.value}" has no ${forms} form, so counts such as ${counts} render with "other"`));
            }
        }
        if ((node.pluralType || 'cardinal') === 'cardinal') {
            const unused = Object.keys(node.options).filter((c) => !c.startsWith('=') && !used.includes(c));
            if (unused.length) {
                findings.push(finding('plural-unused-category', 'warning', `plural "${node.value}" has a ${unused.join('/')} form that ${locale} never selects${unused.includes('one') ? '; for exactly one, write =1' : ''}`));
            }
        }
    }

    // Two plurals on one variable fail the same way; say it once.
    return findings.filter((f, i) => findings.findIndex((g) => g.message === f.message) === i);
}
