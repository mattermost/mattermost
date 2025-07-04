// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

describe('Archive channel members spec', () => {
    before(() => {
        // # Login as test user and visit create channel
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({team, channel}) => {
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T1719 Archived channel members cannot be managed', () => {
        // # click on channel drop-down menu
        cy.get('#channelHeaderTitle').click();

        // * Members menu option should be visible;
        cy.get('#channelMembers').should('be.visible');

        // # Close the channel dropdown menu
        cy.get('body').type('{esc}{esc}');

        // # Archive the channel
        cy.uiArchiveChannel();

        // # click on channel drop-down menu
        cy.get('#channelHeaderTitle').click();

        // # click on view members menu option;
        cy.get('#channelMembers').should('be.visible').click();

        // * Ensure there are no options to change channel roles or membership
        cy.uiGetRHS().findByText('Manage').should('not.exist');
    });
});
