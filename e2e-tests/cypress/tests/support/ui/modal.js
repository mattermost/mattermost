// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';

Cypress.Commands.add('uiCloseModal', (headerLabel) => {
    // # Close modal with modal label
    cy.get('#genericModalLabel', {timeout: TIMEOUTS.HALF_MIN}).should('have.text', headerLabel).parents().find('.modal-dialog').findByLabelText('Close').click();
});
