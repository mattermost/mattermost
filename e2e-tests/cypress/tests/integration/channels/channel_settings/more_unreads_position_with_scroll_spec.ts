// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel_settings

import * as TIMEOUTS from '../../../fixtures/timeouts';

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

        // # Post message as the second user, in a channel near the top of the list
        cy.apiGetChannelByName(myTeam.name, channelNames[firstChannelIndex]).then(({channel}) => {
            cy.postMessageAs({
                sender: otherUser,
                message: 'Bleep bloop I am a robot',
                channelId: channel.id,
            });

            // # Scroll down in channels list until last created channel is visible
            cy.get(`#sidebarItem_${channelNames[lastChannelIndex]}`).scrollIntoView({duration: TIMEOUTS.TWO_SEC});
            cy.get('.scrollbar--view').scrollTo('bottom');
        });

        // * After scrolling is complete, "More Unreads" pill should be visible at the top of the channels list
        cy.get('#unreadIndicatorBottom').should('not.be.visible');

        // * "More Unreads" pill should be visible at the top of the channels list
        // # Click on "More Unreads" pill
        cy.get('#unreadIndicatorTop').should('be.visible').click();

        // # Post as another user in a channel near the bottom of the list, scroll channels list to view it (should be in bold)
        cy.apiGetChannelByName(myTeam.name, channelNames[lastChannelIndex]).then(({channel}) => {
            cy.postMessageAs({
                sender: otherUser,
                message: 'Bleep bloop I am a robot',
                channelId: channel.id,
            });

            // # Scroll down in channels list until last created channel is visible
            cy.get(`#sidebarItem_${channelNames[firstChannelIndex]}`).scrollIntoView({duration: TIMEOUTS.TWO_SEC});
            cy.get('.scrollbar--view').scrollTo('top');
        });

        // * After scrolling is complete, "More Unreads" pill should not be visible at the top of the channels list
        cy.get('#unreadIndicatorTop').should('not.be.visible');

        // * "More Unreads" pill should be visible at the bottom of the channels list
        // # Click on "More Unreads" pill
        cy.get('#unreadIndicatorBottom').should('be.visible').click();

        // * "More Unreads" pill should not be visible at the bottom of the channels list & visible at the top
        cy.get('#unreadIndicatorBottom').should('not.be.visible');
        cy.get('#unreadIndicatorTop').should('be.visible');
    });
});
