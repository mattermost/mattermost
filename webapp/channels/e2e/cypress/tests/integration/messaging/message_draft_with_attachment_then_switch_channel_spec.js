// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

describe('Message Draft with attachment and Switch Channels', () => {
    let testChannel1;
    let testChannel2;

    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            testChannel1 = channel;

            cy.apiCreateChannel(team.id, 'channel', 'Channel').then((out) => {
                testChannel2 = out.channel;
            });
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T129 Message Draft Pencil Icon - No text, only file attachment', () => {
        cy.get(`#sidebarItem_${testChannel1.name}`).click({force: true});

        // # Validate if the channel has been opened
        cy.url().should('include', '/channels/' + testChannel1.name);

        // # Validate if the draft icon is not visible on the sidebar before making a draft
        cy.get(`#sidebarItem_${testChannel1.name}`).findByTestId('draftIcon').should('not.exist');

        // # Upload a file on center view
        cy.get('#fileUploadInput').attachFile('mattermost-icon.png');

        // # Go to test channel without submitting the draft in the previous channel
        cy.get(`#sidebarItem_${testChannel2.name}`).click({force: true});

        // # Validate if the newly navigated channel is open
        cy.url().should('include', '/channels/' + testChannel2.name);

        // # Validate if the draft icon is visible in side bar for the previous channel
        cy.get(`#sidebarItem_${testChannel1.name}`).findByTestId('draftIcon').should('be.visible');
    });
});
