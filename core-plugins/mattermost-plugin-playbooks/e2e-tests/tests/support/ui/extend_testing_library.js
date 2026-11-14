// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

Cypress.Commands.add('findByRoleExtended', (role, {name}) => {
    const re = RegExp(name, 'i');
    return cy.findByRole(role, {name: re}).should('have.text', name);
});
