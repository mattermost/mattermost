// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

describe('Leaving archived channels', () => {
    let testTeam;

    before(() => {
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            testTeam = team;
        });
    });

    it('MM-T1685 User can leave archived public channel', () => {
        // # Create a new public channel
        cy.apiCreateChannel(testTeam.id, 'channel', 'channel').then(({channel}) => {
            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Archive the channel
            cy.uiArchiveChannel();

            // # Leave the channel
            cy.uiLeaveChannel();

            // * Verify that we've switched to Town Square
            cy.url().should('include', '/channels/town-square');
        });
    });

    it('MM-T1686 User can leave archived private channel', () => {
        // # Create a new private channel
        cy.apiCreateChannel(testTeam.id, 'channel', 'channel', 'P').then(({channel}) => {
            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Archive the channel
            cy.uiArchiveChannel();

            // # Leave the channel
            cy.uiLeaveChannel(true);

            // * Verify that we've switched to Town Square
            cy.url().should('include', '/channels/town-square');
        });
    });
});
