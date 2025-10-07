// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel_settings

describe('Channel settings', () => {
    let mainUser: Cypress.UserProfile;
    let otherUser: Cypress.UserProfile;
    let myTeam: Cypress.Team;

    // # Ensure a list of channel names that will be alphabetically sorted
    const channelNames = new Array(20).fill(1).map((value, index) => `scroll${index}`);

    before(() => {
        // # Create a user and a team (done by apiInitSetup)
        cy.apiInitSetup().then(({team, user: firstUser}) => {
            mainUser = firstUser;
            myTeam = team;

            // # Create another user and add it to the same team
            cy.apiCreateUser().then(({user: secondUser}) => {
                otherUser = secondUser;
                cy.apiAddUserToTeam(team.id, secondUser.id);
            });

            // # Create 20 channels (based on length of channelNames array) to ensure that the channels list is scrollable
            cy.wrap(channelNames).each((name) => {
                const displayName = `channel-${name}`;
                cy.apiCreateChannel(team.id, name.toString(), displayName, 'O', '', '', false).then(({channel}) => {
                    // # Add our 2 created users to each channel so they can both post messages
                    cy.apiAddUserToChannel(channel.id, mainUser.id);
                    cy.apiAddUserToChannel(channel.id, otherUser.id);
                });
            });
        });
    });

    it('MM-T888 Channel sidebar: More unreads', () => {
        const firstChannelIndex = 0;
        const lastChannelIndex = channelNames.length - 1;

        // # Navigate to off-topic channel
        cy.apiLogin(mainUser);
        cy.visit(`/${myTeam.name}/channels/off-topic`);

        // # Wait for channels to load
        cy.get(`#sidebarItem_${channelNames[firstChannelIndex]}`).should('be.visible');

        // # Nudge the scrollbar slightly to make the "More Unreads" pills appear
        // @hmhealey - They seem to appear automatically on a regular browser, but not when running under Cypress
        cy.get('#SidebarContainer .simplebar-content-wrapper').scrollTo(0, 1);

        // * The bottom "More Unreads" pill should be visible and the top one should not
        cy.get('#unreadIndicatorTop').should('not.be.visible');
        cy.get('#unreadIndicatorBottom').should('be.visible');

        // # Click on the "More Unreads" pill to scroll down to the bottom
        cy.get('#unreadIndicatorBottom').click();

        // * The list should have scrolled down to the bottom
        cy.get(`#sidebarItem_${channelNames[firstChannelIndex]}`).should('not.be.visible');
        cy.get(`#sidebarItem_${channelNames[lastChannelIndex]}`).should('be.visible');

        // * The top "More Unreads" pill should now be visible and the bottom one should not
        cy.get('#unreadIndicatorTop').should('be.visible');
        cy.get('#unreadIndicatorBottom').should('not.be.visible');

        // * The "More Unreads" pill should now be visible at the top of the channels list
        // # Click on the "More Unreads" pill to scroll up to the top
        cy.get('#unreadIndicatorTop').click();

        // * The list should have scrolled up to the top
        cy.get(`#sidebarItem_${channelNames[firstChannelIndex]}`).should('be.visible');
        cy.get(`#sidebarItem_${channelNames[lastChannelIndex]}`).should('not.be.visible');

        // # Scroll somewhere to the middle of the list
        cy.get('#SidebarContainer .simplebar-content-wrapper').scrollTo(0, 200);

        // * Both "More Unreads" pills should now be visible
        cy.get('#unreadIndicatorTop').should('be.visible');
        cy.get('#unreadIndicatorBottom').should('be.visible');
    });
});
