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

Cypress.Commands.add('typeWithForce', {prevSubject: true}, (subject, text, options = {}) => {
    cy.get(subject).type(text, {force: true, ...options});
});
