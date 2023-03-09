// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

describe('Identical Message Drafts', () => {
    let testTeam;
    let testChannelA;
    let testChannelB;

    before(() => {
        // # Login as test user and visit test channel
        cy.apiInitSetup({
            loginAfter: true,
            channelPrefix: {name: 'ca', displayName: 'CB'},
        }).then(({team, channel}) => {
            testTeam = team;
            testChannelA = channel;

            cy.apiCreateChannel(testTeam.id, 'cb', 'CB').then((out) => {
                testChannelB = out.channel;
            });

            cy.visit(`/${testTeam.name}/channels/${testChannelA.name}`);
            cy.postMessage('hello');
        });
    });

    it('MM-T132 Identical Message Drafts - Autocomplete shown in each channel', () => {
        // # Start a draft in Channel A containing just "@"
        cy.uiGetPostTextBox().type('@');

        // * At mention auto-complete appears in Channel A
        cy.get('#suggestionList').should('be.visible');

        // # Go to test Channel B on sidebar
        cy.get(`#sidebarItem_${testChannelB.name}`).should('be.visible').click();

        // * Validate if the newly navigated channel is open
        // * autocomplete should not be visible in channel
        cy.url().should('include', `/channels/${testChannelB.name}`);
        cy.get('#suggestionList').should('not.exist');

        // # Start a draft in Channel B containing just "@"
        cy.uiGetPostTextBox().type('@');

        // * At mention auto-complete appears in Channel B
        cy.get('#suggestionList').should('be.visible');

        // # Go to Channel C then back to test Channel A on sidebar
        cy.get('#sidebarItem_off-topic').should('be.visible').click();
        cy.get(`#sidebarItem_${testChannelA.name}`).should('be.visible').click();

        // * Validate if the channel has been opened
        // * At mention auto-complete is preserved in Channel A
        cy.url().should('include', `/channels/${testChannelA.name}`);
        cy.uiGetPostTextBox();
        cy.get('#suggestionList').should('be.visible');
    });
});

