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
export declare const TEST_ID_ROLES: readonly ['button', 'link', 'textbox', 'searchbox', 'checkbox', 'switch', 'radio', 'radiogroup', 'combobox', 'listbox', 'option', 'tab', 'tablist', 'tabpanel', 'menu', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'dialog', 'alertdialog', 'slider', 'spinbutton', 'togglebutton', 'text', 'img', 'list', 'listitem', 'row', 'grid', 'gridcell', 'status', 'alert', 'tooltip', 'region', 'group', 'separator'];
export type TestIdRole = (typeof TEST_ID_ROLES)[number];
export declare const TEST_ID_WORD: RegExp;
export type TestIdParts = {
    scope: string[];
    name: string;
    hasKey: boolean;

    /** The literal key, or null when there is none or runtime data fills it. */
    key: string | null;
    role: TestIdRole | null;

    /** The testid continues a scope composed at run time (`${testId}.close--button`). */
    composed: boolean;
};

/** The first rule a testid breaks. */
export type TestIdProblem = {
    problem: 'unknown_role';
    role: string;
} | {
    problem: 'dashes_in_path';
} | {
    problem: 'empty_key';
} | {
    problem: 'data_outside_key';
} | {
    problem: 'composed_without_separator';
} | {
    problem: 'word';
    word: string;
} | {
    problem: 'unscoped';
    word: string;
};

/**
 * Where runtime data sits in a template: `key` stands for data in the key, and `prefix`, at the very start, for a
 * scope composed at run time.
 */
export type TestIdMarks = {
    key: string;
    prefix?: string;
};

/**
 * Parses a testid, or a template with runtime data marked.
 *
 * The key is everything after the FIRST `:`, up to a final `--<known role>`. Nothing in a key is escaped and nothing is
 * rejected: `plugin:com.mattermost.calls--button` has the key `com.mattermost.calls`, `setting:ServiceSettings.SiteURL`
 * the key `ServiceSettings.SiteURL`, `item:a:b--c--option` the key `a:b--c`.
 */
export declare function parseTestId(text: string, marks: TestIdMarks): TestIdParts | TestIdProblem;
export declare function isTestIdProblem(p: TestIdParts | TestIdProblem): p is TestIdProblem;

/**
 * The key of a keyed testid whose template is known (`prefix` up to and including the `:`, `suffix` the `--role` or
 * empty): exact, whatever the key holds. This is what generated code and `KeyedList` use.
 */
export declare function keyOf(testId: string, prefix: string, suffix: string): string | null;

/**
 * The key of a keyed testid whose template is not known (an element found some other way): the parser's reading.
 * Exact for every element with a role suffix, and for a role-less element unless its key itself ends in
 * `--<known role>`, which the `key-origin` rule keeps from happening: such a key reads the same as a role suffix.
 */
export declare function keyOfTestId(testId: string): string | null;

/**
 * Every element of a keyed part: `<prefix><key><suffix>`, for `getByTestId(pattern)`. The key is one or more of any
 * character. The scan's `collisions` rule guarantees a keyed name has one template in its scope, so a role-less
 * pattern never has a sibling with a role to exclude.
 */
export declare function keyedPattern(prefix: string, suffix: string): RegExp;
