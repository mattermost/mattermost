// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channel

describe('Archive channel members spec', () => {
    before(() => {
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        // # Login as test user and visit create channel
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({team, channel}) => {
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T1719 Archived channel members cannot be managed', () => {
        // # click on channel drop-down menu
        cy.get('#channelHeaderTitle').click();

        // * View members menu option should not be visible;
        cy.get('#channelViewMembers').should('not.exist');

        // * Manage members menu option should be visible;
        cy.get('#channelManageMembers').should('be.visible');

        // # Close the channel dropdown menu
        cy.get('#channelHeaderTitle').click();

        // # Archive the channel
        cy.uiArchiveChannel();

        // # click on channel drop-down menu
        cy.get('#channelHeaderTitle').click();

        // * Manage members menu option should not be visible;
        cy.get('#channelManageMembers').should('not.exist');

        // # click on view members menu option;
        cy.get('#channelViewMembers button').should('be.visible').click();

        // * Ensure there are no options to change channel roles or membership
        cy.uiGetRHS().findByText('Manage').should('not.exist');
    });
});
