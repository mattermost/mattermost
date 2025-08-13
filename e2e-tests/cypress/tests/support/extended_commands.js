// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../fixtures/timeouts';

Cypress.Commands.overwrite('reload', (originalFn, forceReload, options, duration = TIMEOUTS.THREE_SEC) => {
    localStorage.setItem('__landingPageSeen__', 'true');
    originalFn(forceReload, options);
    cy.wait(duration);
});

Cypress.Commands.overwrite('visit', (originalFn, url, options, duration = TIMEOUTS.THREE_SEC) => {
    localStorage.setItem('__landingPageSeen__', 'true');
    originalFn(url, options);
    cy.wait(duration);
});

Cypress.Commands.overwrite('request', (originalFn, options) => {
    // Skip CSRF token injection for login requests
    if (options.url.includes('/api/v4/users/login')) {
        return originalFn(options);
    }

    // If it has an Authorization header, skip CSRF token injection
    if (options?.headers?.Authorization) {
        return originalFn(options);
    }

    // Inject CSRF token into the request headers if it exists
    // This is necessary for POST, PUT, DELETE requests to ensure CSRF protection
    return cy.getCookie('MMCSRF').then((csrfCookie) => {
        if (csrfCookie) {
            if (!options.headers) {
                options.headers = {};
            }

            options.headers = {
                ...options.headers,
                'X-CSRF-Token': csrfCookie.value,
            };
        }

        return originalFn(options);
    });
});

Cypress.Commands.add('typeWithForce', {prevSubject: true}, (subject, text, options = {}) => {
    cy.get(subject).type(text, {force: true, ...options});
});
