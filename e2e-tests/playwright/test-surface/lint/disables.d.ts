// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** The prefix of every spec rule of this plugin; a disable of any of them needs a reason. */
export declare const E2E_RULE_PREFIX: 'test-surface/e2e-';

/** Whether a rule name is one of the spec rules, whose disables need a reason. */
export declare function isE2eRule(rule: string): boolean;

/** A comment's text read as a disable directive: the rules it names (none: every rule) and its reason, or null. */
export declare function parseDisable(comment: string): {rules: string[]; reason: string} | null;
