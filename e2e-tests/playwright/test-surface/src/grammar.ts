// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** Runtime keys are normalized to `{key}` in scanner templates. */

import {isTestIdProblem, parseTestId as parseGrammar, TEST_ID_ROLES, type TestIdParts, type TestIdProblem} from '../lint/grammar.js';

export const KEY_PLACEHOLDER = '{key}';

/** A template's parts (`key` is the literal key, or null where runtime data fills it). The scanner never composes. */
export type ParsedTestId = Omit<TestIdParts, 'composed'>;

export type GrammarError = {rule: 'grammar' | 'unscoped'; message: string; fix: string};

/**
 * Parses a testid or template (`{key}` stands for runtime data). Returns the parse or the
 * first rule it breaks, with a suggested fix.
 */
export function parseTestId(id: string): ParsedTestId | GrammarError {
    const p = parseGrammar(id, {key: KEY_PLACEHOLDER});
    if (isTestIdProblem(p)) {
        return grammarError(id, p);
    }
    return {scope: p.scope, name: p.name, hasKey: p.hasKey, key: p.key, role: p.role};
}

function grammarError(id: string, p: TestIdProblem): GrammarError {
    switch (p.problem) {
    case 'unknown_role':
        return {rule: 'grammar', message: `"${id}" has an unknown role "--${p.role}".`, fix: `Use one of: ${TEST_ID_ROLES.join(', ')}.`};
    case 'dashes_in_path':
        return {rule: 'grammar', message: `"${id}" contains "--" in its path.`, fix: 'Only the role suffix may follow "--". Inside names use "_".'};
    case 'empty_key':
        // eslint-disable-next-line no-template-curly-in-string
        return {rule: 'grammar', message: `"${id}" has an empty key after ":".`, fix: 'Write the key as `:${value}` or drop the ":".'};
    case 'data_outside_key':
    case 'composed_without_separator':
        // eslint-disable-next-line no-template-curly-in-string
        return {rule: 'grammar', message: `"${id}" has runtime data outside the key.`, fix: 'Only the last word may carry runtime data, after ":" (`name:${value}`).'};
    case 'word': {
        const hint = p.word ? toWord(p.word) : '';
        return {
            rule: 'grammar',
            message: `"${id}" has the word "${p.word}", which is not lower_snake_case.`,
            fix: hint && hint !== p.word ? `Words match [a-z][a-z0-9_]*, e.g. "${hint}".` : 'Words match [a-z][a-z0-9_]*.',
        };
    }
    case 'unscoped':
        return {rule: 'unscoped', message: `"${id}" has no scope.`, fix: 'Prefix it with where it lives, e.g. "channel_header.menu.' + toWord(p.word) + '".'};
    default: {
        // a problem the grammar added that this mapping doesn't word yet fails to compile here
        const unhandled: never = p;
        return unhandled;
    }
    }
}

export function isGrammarError(p: ParsedTestId | GrammarError): p is GrammarError {
    return 'rule' in p;
}

/** Formats a parse back into a template. */
export function formatTestId(p: Pick<ParsedTestId, 'scope' | 'name' | 'hasKey' | 'role'>): string {
    return [...p.scope, p.name].join('.') + (p.hasKey ? ':' + KEY_PLACEHOLDER : '') + (p.role ? '--' + p.role : '');
}

/** camelCase/kebab/PascalCase -> snake_case word. */
export function toWord(s: string): string {
    return s.
        replace(/([a-z0-9])([A-Z])/g, '$1_$2').
        replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').
        replace(/[^A-Za-z0-9]+/g, '_').
        replace(/^_+|_+$/g, '').
        toLowerCase().
        replace(/^([0-9])/, 'n$1');
}

/**
 * Whether a config entry's template names an element's: the same template, or under any scope for one starting with
 * `*.` (`checks.allow`).
 */
export function allowCovers(entryTemplate: string, template: string): boolean {
    return entryTemplate.startsWith('*.') ? template.endsWith(entryTemplate.slice(1)) : template === entryTemplate;
}
