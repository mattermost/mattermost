// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @status

describe('Status of current user', () => {
    before(() => {
        // # Login as test user and visit channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it("Changes to the current user's status made from the profile/status dropdown should be shown in real time", () => {
        // * The user's status should start as online
        verifyStatus('online');

        // # Open status menu
        cy.uiGetSetStatusButton().click();

        // # Change status to away
        cy.findByText('Away').click();

        // * The status should be updated to away
        verifyStatus('away');

        // # Open status menu
        cy.uiGetSetStatusButton().click();

        // # Change status to offline
        cy.findByText('Offline').click();

        // * The status should be updated to offline
        verifyStatus('offline');

        // # Open status menu
        cy.uiGetSetStatusButton().click();

        // # Change status back to online
        cy.findByText('Online').click();

        // * The status should be updated to online
        verifyStatus('online');
    });

    it("Changes to the current user's status made using slash commands should be shown in real time", () => {
        // * The user's status should start as online
        verifyStatus('online');

        // # Change status to away
        cy.postMessage('/away ');

        // * Wait for the response from the server
        cy.findByText('You are now away').should('exist');

        // * The status should be updated to away
        verifyStatus('away');

        // # Change status to offline
        cy.postMessage('/offline ');

        // * Wait for the response from the server
        cy.findByText('You are now offline').should('exist');

        // * The status should be updated to offline
        verifyStatus('offline');

        // # Change status to do not disturb
        cy.postMessage('/dnd ');

        // * Wait for the response from the server
        cy.findByText('Do Not Disturb is enabled. You will not receive desktop or mobile push notifications until Do Not Disturb is turned off.').should('exist');

        // * The status should be updated to offline
        verifyStatus('dnd');

        // # Change status back to online
        cy.postMessage('/online ');

        // * Wait for the response from the server
        cy.findByText('You are now online').should('exist');

        // * The status should be updated to online
        verifyStatus('online');
    });
});

function verifyStatus(status: 'online' | 'away' | 'offline' | 'dnd') {
    cy.get('[aria-label="Status is \\"Online\\". Open user\'s account menu."]').
        should(status === 'online' ? 'exist' : 'not.exist');
    cy.get('[aria-label="Status is \\"Away\\". Open user\'s account menu."]').
        should(status === 'away' ? 'exist' : 'not.exist');
    cy.get('[aria-label="Status is \\"Offline\\". Open user\'s account menu."]').
        should(status === 'offline' ? 'exist' : 'not.exist');
    cy.get('[aria-label="Status is \\"Do not disturb\\". Open user\'s account menu."]').
        should(status === 'dnd' ? 'exist' : 'not.exist');
}
