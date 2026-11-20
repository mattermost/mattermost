// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// A disable of the spec action rules names the rule and says why: `// eslint-disable-next-line
// test-surface/e2e-observe-actions -- <reason>`. A disable without a rule list silences them too, so it needs both.
import {ACTION_RULES, parseDisable} from './disables.js';

export default {
    meta: {
        type: 'problem',
        docs: {description: 'Give a reason for every disable of the spec action rules'},
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
                        context.report({loc: comment.loc, messageId: 'unnamed', data: {rule: ACTION_RULES[0]}});
                        continue;
                    }
                    const guarded = directive.rules.find((rule) => ACTION_RULES.includes(rule));
                    if (guarded && !directive.reason) {
                        context.report({loc: comment.loc, messageId: 'reason', data: {rule: guarded}});
                    }
                }
            },
        };
    },
};
