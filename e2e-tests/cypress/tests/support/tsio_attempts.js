// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const attemptsByTest = new Map();

// after:spec in Cypress 15 exposes attempt states only. Preserve the error,
// duration and existing screenshot context while each browser attempt is
// still available; the final Mochawesome test carries the complete list.
module.exports = (test, runnable, addContext) => {
    const key = runnable.fullTitle();
    const attempts = attemptsByTest.get(key) || [];
    const context = (Array.isArray(test.context) ? test.context : [test.context]).filter((entry) => entry && entry.title !== 'tsio-attempts-v1');
    attempts.push({
        state: test.state,
        duration: test.duration || 0,
        err: test.err ? {message: test.err.message, estack: test.err.stack} : null,
        context: JSON.stringify(context),
    });
    attemptsByTest.set(key, attempts);
    addContext({test}, {title: 'tsio-attempts-v1', value: attempts});
};
