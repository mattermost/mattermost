// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// A disable of a spec rule (any `test-surface/e2e-*` rule) names the rule and says why: `// eslint-disable-next-line
// test-surface/e2e-no-literal-locators -- <reason>`. A disable without a rule list silences them too, so it needs both.
import {isE2eRule, parseDisable} from './disables.js';

/**
 * Where the `unnamed` report goes. A bare `eslint-disable-line` or `eslint-disable` silences every rule from its own
 * position, this one included, so those are reported on the line before the comment (line 0 for a comment on the first
 * line), which the directive does not reach. A bare `eslint-disable-next-line` does not reach its own line.
 */
function unnamedLoc(comment) {
    if ((/^\s*eslint-disable-next-line(?:\s|$)/).test(comment.value)) {
        return comment.loc;
    }
    const line = comment.loc.start.line - 1;
    return {start: {line, column: 0}, end: {line, column: 1}};
}

export default {
    meta: {
        type: 'problem',
        docs: {description: 'Give a reason for every disable of a spec rule'},
        schema: [],
        messages: {
            reason: 'say why `{{rule}}` is disabled here: `-- <reason>` after the rule name.',
            unnamed: 'name the rules this disables, with a reason: a bare disable also silences `{{rule}}`.',
        },
    },
    create(context) {
        return {
            Program() {
                for (const comment of context.sourceCode.getAllComments()) {
                    const directive = parseDisable(comment.value);
                    if (!directive) {
                        continue;
                    }
                    if (!directive.rules.length) {
                        context.report({loc: unnamedLoc(comment), messageId: 'unnamed', data: {rule: 'test-surface/e2e-no-literal-locators'}});
                        continue;
                    }
                    const guarded = directive.rules.find(isE2eRule);
                    if (guarded && !directive.reason) {
                        context.report({loc: comment.loc, messageId: 'reason', data: {rule: guarded}});
                    }
                }
            },
        };
    },
};
