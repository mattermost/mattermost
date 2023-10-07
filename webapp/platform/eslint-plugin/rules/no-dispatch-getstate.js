// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

module.exports = {
    meta: {
        type: 'problem',
        fixable: 'code',
        messages: {
            unexpected: 'Unexpected second argument passed to dispatch. getState does not need to be passed into dispatch.',
        },
    },
    create(context) {
        function checkDispatch(node) {
            const args = node.arguments;
            if (args.length === 2) {
                context.report({
                    node,
                    messageId: 'unexpected',
                    fix(fixer) {
                        const sourceCode = context.getSourceCode();

                        const before = sourceCode.getTokenBefore(args[1]);
                        const after = sourceCode.getTokenAfter(args[1]);

                        // Remove the getState argument and the preceding comma
                        const fixes = [
                            fixer.remove(before),
                            fixer.remove(args[1]),
                        ];

                        // And remove the trailing comma if one exists
                        if (after.type === 'Punctuator' && after.value === ',') {
                            fixes.push(fixer.remove(after));
                        }

                        // Note that this sometimes mangles the whitespace slightly

                        return fixes;
                    },
                });
            }
        }

        return {
            "CallExpression[callee.name='dispatch']": checkDispatch,
            "CallExpression[callee.name='doDispatch']": checkDispatch,
        };
    },
};
