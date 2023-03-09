// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @commands

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Leave Channel Command', () => {
    let testChannel;

    before(() => {
        // # Login as test user and go to town-square
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            testChannel = channel;
            cy.visit(`/${team.name}/channels/town-square`);
            cy.get('#channelHeaderTitle').should('be.visible').and('contain', 'Town Square');
        });
    });

    it('Should be redirected to last channel when user leaves channel with /leave command', () => {
        // # Go to newly created channel
        cy.get('#sidebarItem_' + testChannel.name).click({force: true});
        cy.findAllByTestId('postView').should('be.visible');

        // # Post /leave command in center channel
        cy.postMessage('/leave ');
        cy.wait(TIMEOUTS.TWO_SEC); // eslint-disable-line cypress/no-unnecessary-waiting

        // * Assert that user is redirected to townsquare
        cy.url().should('include', '/channels/town-square');
        cy.get('#channelHeaderTitle').should('be.visible').and('contain', 'Town Square');
    });
});
