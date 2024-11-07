// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @channel

import {measurePerformance} from './utils.js';

describe('Channel switch performance test', () => {
    let teamName;

    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            teamName = team;

            // # Go to town square
            cy.visit(`/${team.name}/channels/town-square`);
            cy.get('#sidebarItem_off-topic').should('be.visible');
        });
    });

    it('measures switching between two channels from LHS', () => {
        measurePerformance(
            'channelLoad',
            800,
            () => {
                // # Switch channel to Off-topic

                cy.get('#sidebarItem_off-topic').click({force: true});

                // * Expect that the user is now in Off-Topic
                return expectActiveChannelToBe('Off-Topic', '/off-topic');
            },

            // # Reset test run so we can start on the initially specified channel
            () => {
                cy.visit(`/${teamName.name}/channels/town-square`);
                cy.get('#sidebarItem_off-topic').should('be.visible');
            },
        );
    });
});

const expectActiveChannelToBe = (title, url) => {
    // * Expect channel title to match title passed in argument
    cy.get('#channelHeaderTitle').
        should('be.visible').
        and('contain.text', title);

    // * Expect that center channel is visible and page has loaded
    cy.get('#app-content').should('be.visible');

    // * Expect url to match url passed in argument
    return cy.url().should('contain', url);
};
