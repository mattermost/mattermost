"use strict";

module.exports = {
    configs: {
        base: {
            extends: [
                require.resolve('./configs/.eslintrc.json'),
            ],
        },
        react: {
            extends: [
                require.resolve('./configs/.eslintrc.json'),
                require.resolve('./configs/.eslintrc-react.json'),
            ],
        },
    },
    rules: {
        'no-dispatch-getstate': require('./rules/no-dispatch-getstate'),
        'use-external-link': require('./rules/use-external-link'),
    },
};
