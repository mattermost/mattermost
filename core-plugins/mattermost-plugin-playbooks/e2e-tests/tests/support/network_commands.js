// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

Cypress.Commands.add('waitForNetworkIdle', (options = {}) => {
    const {
        idleTime = 500,
        timeout = 2000,
        method = null,
        urlPattern = null,
    } = options;

    let lastRequestTime = Date.now();
    let pendingRequests = 0;
    const requestStartTime = Date.now();

    cy.intercept('*', (req) => {
        if (method && req.method !== method) {
            return;
        }
        if (urlPattern && !req.url.match(urlPattern)) {
            return;
        }

        pendingRequests++;
        lastRequestTime = Date.now();

        req.continue(() => {
            pendingRequests--;
            lastRequestTime = Date.now();
        });
    });

    cy.waitUntil(
        () => {
            const timeSinceLastRequest = Date.now() - lastRequestTime;
            const totalElapsedTime = Date.now() - requestStartTime;

            if (totalElapsedTime >= timeout) {
                return true;
            }

            return pendingRequests === 0 && timeSinceLastRequest >= idleTime;
        },
        {
            timeout: timeout + 100,
            interval: 50,
            errorMsg: `Network did not become idle within ${timeout}ms`,
        },
    );
});

Cypress.Commands.add('waitForGraphQLQueries', (options = {}) => {
    const {
        idleTime = 500,
        timeout = 2000,
    } = options;

    cy.waitForNetworkIdle({
        idleTime,
        timeout,
        urlPattern: /\/plugins\/playbooks\/api\/v0\/query/,
    });
});
