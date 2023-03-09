// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @account_setting @not_cloud

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Settings > Sidebar > Channel Switcher', () => {
    let testChannel;
    let testTeam;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            testChannel = channel;
            testTeam = team;

            // # Create more test channels
            const numberOfChannels = 14;
            Cypress._.forEach(Array(numberOfChannels), (_, index) => {
                cy.apiCreateChannel(testTeam.id, 'channel-switcher', `Channel Switcher ${index.toString()}`);
            });
        });
    });

    beforeEach(() => {
        // # Visit off-topic
        cy.visit(`/${testTeam.name}/channels/off-topic`);
        cy.get('#channelHeaderTitle').should('be.visible').should('contain', 'Off-Topic');
    });

    it('MM-T266 Using CTRL/CMD+K to show Channel Switcher', () => {
        // # Type CTRL/CMD+K
        cy.typeCmdOrCtrl().type('K', {release: true});

        verifyChannelSwitch(testTeam, testChannel);
    });
});

function verifyChannelSwitch(team, channel) {
    // * Channel switcher hint should be visible
    cy.get('#quickSwitchHint').should('be.visible').should('contain', 'Type to find a channel. Use UP/DOWN to browse, ENTER to select, ESC to dismiss.');

    // # Type channel display name on Channel switcher input
    cy.findByRole('textbox', {name: 'quick switch input'}).type(channel.display_name);
    cy.wait(TIMEOUTS.HALF_SEC);

    // * Suggestion list should be visible
    cy.get('#suggestionList').should('be.visible');

    // # Press enter
    cy.findByRole('textbox', {name: 'quick switch input'}).type('{enter}');

    // * Verify that it redirected into "channel-switcher" as selected channel
    cy.url().should('include', `/${team.name}/channels/${channel.name}`);
    cy.get('#channelHeaderTitle').should('be.visible').should('contain', channel.display_name);

    // * Channel name should be visible in LHS
    cy.get(`#sidebarItem_${channel.name}`).scrollIntoView().should('be.visible');
}
