// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

describe('Profile > Security > View Access History', () => {
    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    beforeEach(() => {
        // # Go to Profile
        cy.uiOpenProfileModal('Security');

        // * Check that the Security tab is loaded
        cy.get('#securityButton').should('be.visible');

        // # Click the Security tab
        cy.get('#securityButton').click();
    });

    it('MM-T2087 View Access History', () => {
        // # Click "View Access History" link
        cy.findByText('View Access History').should('be.visible').click();

        // * Check that the Access History modal and table are visible
        cy.get('#accessHistoryModalLabel').should('be.visible');
        cy.get('.modal-body table').should('be.visible');

        // * Check that the Access History table has the expected length
        cy.get('.modal-body table thead tr th span').should('be.visible').should('have.length', 4);

        // * Check that the Access History table header has the expected columns
        cy.get('.modal-body table thead tr th span').eq(0).should('be.visible').should('contain', 'Timestamp');
        cy.get('.modal-body table thead tr th span').eq(1).should('be.visible').should('contain', 'Action');
        cy.get('.modal-body table thead tr th span').eq(2).should('be.visible').should('contain', 'IP Address');
        cy.get('.modal-body table thead tr th span').eq(3).should('be.visible').should('contain', 'Session ID');

        // * Check that the Access History table body is visible and not empty
        cy.findByTestId('auditTableBody').should('be.visible').should('not.empty');
    });
});
