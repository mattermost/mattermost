// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The testid grammar. The lint rules, the scanner and the runtime all read this one file (plain JavaScript importing
 * nothing, typed by `grammar.d.ts`): the lib bundles it into `dist`, so the published lib has no dependency on the
 * tool. A key may hold any characters.
 *
 *     testid := path [ ":" KEY ] [ "--" ROLE ]
 *     path   := TEST_ID_WORD ( "." TEST_ID_WORD )*          leading TEST_ID_WORDs = scope, last TEST_ID_WORD = name
 *     TEST_ID_WORD   := [a-z][a-z0-9_]*
 *     KEY    := one or more characters, any characters
 *     ROLE   := one of TEST_ID_ROLES
 */
/** ARIA role suffixes a testid can end with (`--button`). `text` marks read-only content. */
export const TEST_ID_ROLES = [
    'button',
    'link',
    'textbox',
    'searchbox',
    'checkbox',
    'switch',
    'radio',
    'radiogroup',
    'combobox',
    'listbox',
    'option',
    'tab',
    'tablist',
    'tabpanel',
    'menu',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'dialog',
    'alertdialog',
    'slider',
    'spinbutton',
    'togglebutton',
    'text',
    'img',
    'list',
    'listitem',
    'row',
    'grid',
    'gridcell',
    'status',
    'alert',
    'tooltip',
    'region',
    'group',
    'separator',
];
const ROLE_SET = new Set(TEST_ID_ROLES);
export const TEST_ID_WORD = /^[a-z][a-z0-9_]*$/;

/** A final `--<known role>`. `s`: a key may hold line breaks. */
const ROLE_SUFFIX = new RegExp(`^(.*)--(${TEST_ID_ROLES.join('|')})$`, 's');

/**
 * Parses a testid, or a template with runtime data marked.
 *
 * The key is everything after the FIRST `:`, up to a final `--<known role>`. Nothing in a key is escaped and nothing is
 * rejected: `plugin:com.mattermost.calls--button` has the key `com.mattermost.calls`, `setting:ServiceSettings.SiteURL`
 * the key `ServiceSettings.SiteURL`, `item:a:b--c--option` the key `a:b--c`.
 */
export function parseTestId(text, marks) {
    let path = text;
    let key = null;
    let hasKey = false;
    let role = null;
    const colon = text.indexOf(':');
    if (colon >= 0) {
        hasKey = true;
        path = text.slice(0, colon);
        let rest = text.slice(colon + 1);
        const suffix = ROLE_SUFFIX.exec(rest);
        if (suffix) {
            rest = suffix[1];
            role = suffix[2];
        }
        if (!rest.length) {
            return {problem: 'empty_key'};
        }
        key = rest.includes(marks.key) ? null : rest;
    } else {
        const dash = path.lastIndexOf('--');
        if (dash >= 0) {
            const r = path.slice(dash + 2);
            if (!ROLE_SET.has(r)) {
                return {problem: 'unknown_role', role: r};
            }
            role = r;
            path = path.slice(0, dash);
        }
    }

    // from here on `path` is the part before any key and role: words and dots only
    if (path.includes('--')) {
        return {problem: 'dashes_in_path'};
    }
    if (path.includes(marks.key)) {
        return {problem: 'data_outside_key'};
    }
    let composed = false;
    if (marks.prefix && path.startsWith(marks.prefix)) {
        composed = true;
        path = path.slice(marks.prefix.length);
        if (path === '') {
            // the scope's own element: `${testId}`, `${testId}--dialog`, `${testId}:${id}--listitem`
            return {scope: [], name: '', hasKey, key, role, composed};
        }
        if (!path.startsWith('.')) {
            return {problem: 'composed_without_separator'};
        }
        path = path.slice(1);
    }
    if (marks.prefix && path.includes(marks.prefix)) {
        return {problem: 'data_outside_key'};
    }
    const words = path.split('.');
    const bad = words.find((w) => !TEST_ID_WORD.test(w));
    if (bad !== undefined) {
        return {problem: 'word', word: bad};
    }

    // a bare word is only a top-level scope's own element (no key, no role)
    if (!composed && words.length < 2 && (role || hasKey)) {
        return {problem: 'unscoped', word: words[0]};
    }
    return {scope: words.slice(0, -1), name: words[words.length - 1], hasKey, key, role, composed};
}
export function isTestIdProblem(p) {
    return 'problem' in p;
}

/**
 * The key of a keyed testid whose template is known (`prefix` up to and including the `:`, `suffix` the `--role` or
 * empty): exact, whatever the key holds. This is what generated code and `KeyedList` use.
 */
export function keyOf(testId, prefix, suffix) {
    if (testId.length <= prefix.length + suffix.length || !testId.startsWith(prefix) || !testId.endsWith(suffix)) {
        return null;
    }
    return testId.slice(prefix.length, testId.length - suffix.length);
}

/**
 * The key of a keyed testid whose template is not known (an element found some other way): the parser's reading.
 * Exact for every element with a role suffix, and for a role-less element unless its key itself ends in
 * `--<known role>`, which the `key-origin` rule keeps from happening: such a key reads the same as a role suffix.
 */
export function keyOfTestId(testId) {
    const p = parseTestId(testId, {key: '\u0000'});
    return isTestIdProblem(p) ? null : p.key;
}

/**
 * Every element of a keyed part: `<prefix><key><suffix>`, for `getByTestId(pattern)`. The key is one or more of any
 * character. The scan's `collisions` rule guarantees a keyed name has one template in its scope, so a role-less
 * pattern never has a sibling with a role to exclude.
 */
export function keyedPattern(prefix, suffix) {
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escape(prefix)}.+${escape(suffix)}$`, 's');
}
