// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channel @not_cloud

import * as TIMEOUTS from '../../fixtures/timeouts';

const timestamp = Date.now();

function verifyChannel(channel, verifyExistence = true) {
    // # Wait for Channel to be created
    cy.wait(TIMEOUTS.HALF_SEC);

    // # Hover on the channel name
    cy.get(`#sidebarItem_${channel.name}`).should('be.visible').trigger('mouseover');

    // * Verify that the tooltip is displayed
    if (verifyExistence) {
        cy.get('div.tooltip-inner').
            should('be.visible').
            and('contain', channel.display_name);
    } else {
        cy.get('div.tooltip-inner').should('not.exist');
    }

    // # Move cursor away from channel
    cy.get(`#sidebarItem_${channel.name}`).should('be.visible').trigger('mouseout');
}

describe('channel name tooltips', () => {
    let loggedUser;
    let longUser;
    let testTeam;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // # Login as new user and visit off-topic
        cy.apiInitSetup().then(({team, user, offTopicUrl}) => {
            testTeam = team;
            loggedUser = user;

            cy.apiCreateUser({prefix: `thisIsALongUsername${timestamp}`}).then(({user: user1}) => {
                longUser = user1;
                cy.apiAddUserToTeam(testTeam.id, loggedUser.id);
            });

            cy.apiLogin(loggedUser);
            cy.visit(offTopicUrl);
        });
    });

    it('Should show tooltip on hover - open/public channel with long name', () => {
        // # Create new test channel
        cy.apiCreateChannel(
            testTeam.id,
            'channel-test',
            `Public channel with a long name-${timestamp}`,
        ).then(({channel}) => {
            verifyChannel(channel);
        });
    });

    it('Should show tooltip on hover - private channel with long name', () => {
        // # Create new test channel
        cy.apiCreateChannel(
            testTeam.id,
            'channel-test',
            `Private channel with a long name-${timestamp}`,
            'P',
        ).then(({channel}) => {
            verifyChannel(channel);
        });
    });

    it('Should not show tooltip on hover - open/public channel with short name', () => {
        // # Create new test channel
        cy.apiCreateChannel(
            testTeam.id,
            'channel-test',
            'Public channel',
        ).then(({channel}) => {
            verifyChannel(channel, false);
        });
    });

    it('Should not show tooltip on hover - private channel with short name', () => {
        // # Create new test channel
        cy.apiCreateChannel(
            testTeam.id,
            'channel-test',
            'Private channel',
            'P',
        ).then(({channel}) => {
            verifyChannel(channel, false);
        });
    });

    it('Should show tooltip on hover - user with a long username', () => {
        // # Open a DM with the user
        cy.findByRole('button', {name: 'Write a direct message'}).click();
        cy.focused().as('searchBox').typeWithForce(longUser.username);

        // * Verify that the user is selected in the results list before typing enter
        cy.get('div.more-modal__row').
            should('have.length', 1).
            and('have.class', 'clickable').
            and('have.class', 'more-modal__row--selected').
            and('contain.text', longUser.username.toLowerCase());

        cy.get('@searchBox').typeWithForce('{enter}');
        cy.uiGetButton('Go').click();

        // # Hover on the channel name
        cy.get(`#sidebarItem_${Cypress._.sortBy([loggedUser.id, longUser.id]).join('__')}`).scrollIntoView().should('be.visible').trigger('mouseover');

        // * Verify that the tooltip is displayed
        cy.get('div.tooltip-inner').should('be.visible');

        // # Move cursor away from channel
        cy.get(`#sidebarItem_${Cypress._.sortBy([loggedUser.id, longUser.id]).join('__')}`).scrollIntoView().should('be.visible').trigger('mouseout');
    });
});
