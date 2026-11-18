// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export declare const ACTION_RULES: readonly ['test-surface/e2e-observe-actions', 'test-surface/e2e-no-floating-actions'];

/** A comment's text read as a disable directive: the rules it names (none: every rule) and its reason, or null. */
export declare function parseDisable(comment: string): {rules: string[]; reason: string} | null;

/** How many times the source's disable directives name one of `ACTION_RULES`. */
export declare function countActionDisables(source: string, fileName?: string): number;
