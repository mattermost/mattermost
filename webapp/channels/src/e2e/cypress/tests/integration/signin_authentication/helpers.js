// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import timeouts from '../../fixtures/timeouts';

export function fillCredentialsForUser(user) {
    cy.wait(timeouts.TWO_SEC);
    cy.get('#input_loginId').should('be.visible').clear().type(user.username).wait(timeouts.ONE_SEC);
    cy.get('#input_password-input').should('be.visible').clear().type(user.password).wait(timeouts.ONE_SEC);
    cy.get('#saveSetting').click().wait(timeouts.ONE_SEC);
}
