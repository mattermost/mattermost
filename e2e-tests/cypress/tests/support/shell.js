// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

Cypress.Commands.add('shellFind', (path, pattern) => {
    return cy.task('shellFind', {path, pattern});
});

Cypress.Commands.add('shellRm', (option, file) => {
    return cy.task('shellRm', {option, file});
});

Cypress.Commands.add('shellUnzip', (source, target) => {
    return cy.task('shellUnzip', {source, target});
});
