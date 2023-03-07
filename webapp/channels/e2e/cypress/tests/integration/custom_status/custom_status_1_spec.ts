// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @custom_status

describe('Custom Status - CTAs for New Users', () => {
    before(() => {
        cy.apiUpdateConfig({TeamSettings: {EnableCustomUserStatuses: true}});

        // # Login as test user and visit channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T3851_1 should show Update your status in the post header', () => {
        // # Post a message in the channel
        cy.postMessage('Hello World!');

        // * Check if the post header contains "Update your status" button
        cy.get('.post.current--user .post__header').findByText('Update your status').should('exist').and('be.visible');
    });

    it('MM-T3851_2 should open status dropdown with pulsating dot when clicked on Update your status post header', () => {
        // # Click the "Update your status" button
        cy.get('.post.current--user .post__header').findByText('Update your status').click();

        // * Status dropdown should open
        cy.get('#statusDropdownMenu').should('exist');

        // * Pulsating dot should be visible in the status dropdown
        cy.get('#statusDropdownMenu .custom_status__row .pulsating_dot').should('exist');
    });

    it('MM-T3851_3 should remove pulsating dot and Update your status post header after opening modal', () => {
        // # Open custom status modal and close it
        cy.get('#statusDropdownMenu .custom_status__row .pulsating_dot').click();
        cy.get('#custom_status_modal').should('exist').get('button.close').click();

        // * Check if the post header contains "Update your status" button
        cy.get('.post.current--user .post__header').findByText('Update your status').should('not.exist');

        // * Check if the pulsating dot exists by opening status dropdown
        cy.get('.MenuWrapper .status-wrapper').click();
        cy.get('#statusDropdownMenu .custom_status__row .pulsating_dot').should('not.exist');
    });
});
