// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Team Scheme', () => {
    let testTeam;
    const schemeName = 'Test Team Scheme';
    before(() => {
        cy.apiRequireLicense();
        cy.apiCreateTeam('team-scheme-test', 'Scheme Test').then(({team}) => {
            testTeam = team;
        });
        deleteExistingTeamOverrideSchemes();
    });

    beforeEach(() => {
        // # Go to `User Management / Permissions` section
        cy.visit('/admin_console/user_management/permissions');
    });

    it('MM-T2855 Create a Team Override Scheme', () => {
        // # Click `New Team Override Scheme`
        cy.findByTestId('team-override-schemes-link').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // # Type Name and Description
        cy.get('#scheme-name').should('be.visible').type(schemeName);
        cy.get('#scheme-description').type('Description');

        // # Click `Add Teams`
        cy.findByTestId('add-teams').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // # Find and select testTeam
        cy.get('#selectItems input').typeWithForce(testTeam.display_name).wait(TIMEOUTS.HALF_SEC);
        cy.get('#multiSelectList div.more-modal__row.clickable').eq(0).click().wait(TIMEOUTS.HALF_SEC);

        // # Save scheme
        cy.get('#saveItems').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // # Modify the permissions scheme
        const checkId = 'all_users-public_channel-create_public_channel-checkbox';
        cy.findByTestId(checkId).click();

        // # Save scheme
        cy.get('#saveSetting').click().wait(TIMEOUTS.TWO_SEC);

        // * Verify user is returned to the `Permission Schemes` page
        cy.url().should('include', '/admin_console/user_management/permissions');

        // * Verify the newly created scheme is visible
        cy.findByTestId('permissions-scheme-summary').within(() => {
            cy.get('.permissions-scheme-summary--header').should('include.text', schemeName);
            cy.get('.permissions-scheme-summary--teams').should('include.text', testTeam.display_name);
        });

        // * Verify permission got changed as expected
        cy.findByTestId(schemeName + '-edit').click().wait(TIMEOUTS.HALF_SEC);
        cy.findByTestId(checkId).should('not.have.class', 'checked');
    });

    it('MM-T2857 Delete Scheme', () => {
        // # Click `Delete` for the scheme created above
        cy.findByTestId(schemeName + '-delete').click().wait(TIMEOUTS.HALF_SEC);

        // # Click `Cancel` on the confirmation dialog
        cy.get('#cancelModalButton').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify the scheme is still visibile
        cy.findByTestId('permissions-scheme-summary').within(() => {
            cy.get('.permissions-scheme-summary--header').should('include.text', schemeName);
            cy.get('.permissions-scheme-summary--teams').should('include.text', testTeam.display_name);
        });

        // # Click `Delete` for the scheme created above
        cy.findByTestId(schemeName + '-delete').click().wait(TIMEOUTS.HALF_SEC);

        // # Click `Yes, Delete` on the confirmation dialog
        cy.get('#confirmModalButton').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify the scheme is not visibile anymore
        cy.findByTestId('permissions-scheme-summary').should('not.exist');
    });
});

const deleteExistingTeamOverrideSchemes = () => {
    cy.apiGetSchemes('team').then(({schemes}) => {
        schemes.forEach((scheme) => {
            cy.apiDeleteScheme(scheme.id);
        });
    });
};
