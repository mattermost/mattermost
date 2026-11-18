// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The disable directives of the spec rules: how one is read, and which rules need a reason.

/** The prefix of every spec rule of this plugin; a disable of any of them needs a reason. */
export const E2E_RULE_PREFIX = 'test-surface/e2e-';

/** Whether a rule name is one of the spec rules, whose disables need a reason. */
export function isE2eRule(rule) {
    return rule.startsWith(E2E_RULE_PREFIX);
}

const DIRECTIVE = /^\s*eslint-disable(?:-next-line|-line)?(?:\s|$)(.*)$/s;

/**
 * A comment's text (without `//` or `/* *\/`) read as a disable directive: the rules it names and its reason, or null
 * when it is not one. `rules` is empty for a directive that names none, which disables every rule.
 */
export function parseDisable(comment) {
    const match = DIRECTIVE.exec(comment);
    if (!match) {
        return null;
    }
    const [names, ...reason] = match[1].split(/\s--\s|\s--$/);
    return {
        rules: names.split(',').map((rule) => rule.trim()).filter(Boolean),
        reason: reason.join(' -- ').trim(),
    };
}
